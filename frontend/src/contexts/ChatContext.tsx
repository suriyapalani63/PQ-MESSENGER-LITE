/**
 * ChatContext — manages peer list, per-conversation messages, and PQC session integration.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { 
  Peer, Message, FileAttachment, ChannelEvent,
  SessionInitPayload, SessionAckPayload
} from '@/types/messaging';
import {
  loadPeers, savePeers, loadMessages, saveMessages, buildConversationId, loadProfiles, registerProfile
} from '@/services/messagingService';
import { useAuth } from '@/contexts/AuthContext';
import { transport } from '@/services/transport';
import { encapsulate, decapsulate } from '@/crypto/oqsAdapter';
import { getLocalKeyPair } from '@/crypto/keyStore';
import { base64ToBytes, bytesToBase64 } from '@/crypto/encoding';
import { deriveKeyHKDF, encryptPayload, decryptPayload, createEnvelope, verifyEnvelope } from '@/crypto/protocol';
import { getSession, initSession, advanceSendCounter, checkAndAdvanceReceiveCounter } from '@/crypto/sessionStore';
import { EncryptedEnvelope } from '@/types/crypto';

interface ChatContextValue {
  peers: Peer[];
  activePeerId: string | null;
  activeMessages: Message[];
  isLoading: boolean;
  setActivePeerId: (id: string | null) => void;
  addPeer: (peerId: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  sendMessage: (text: string) => Promise<void>;
  sendFileMessage: (fileAttachment: FileAttachment) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { currentUser, cryptoStatus } = useAuth();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Initialize
  useEffect(() => {
    if (!currentUser || cryptoStatus !== 'ready') {
      setPeers([]);
      setMessagesMap({});
      setIsLoading(false);
      return;
    }
    const storedPeers = loadPeers(currentUser.peerId);
    const initialPeers = storedPeers.map(p => ({ ...p, status: 'offline' as const }));
    setPeers(initialPeers);

    const map: Record<string, Message[]> = {};
    for (const p of initialPeers) {
      const convId = buildConversationId(currentUser.peerId, p.peerId);
      map[p.id] = loadMessages(convId);
    }
    setMessagesMap(map);
    setIsLoading(false);

    transport.send('sys-ping', 'PRESENCE_PING', currentUser.peerId, 'broadcast', '', { peerId: currentUser.peerId, name: currentUser.name });
    const interval = setInterval(() => {
      transport.send(`sys-ping-${Date.now()}`, 'PRESENCE_PING', currentUser.peerId, 'broadcast', '', { peerId: currentUser.peerId, name: currentUser.name });
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser, cryptoStatus]);

  useEffect(() => {
    if (currentUser) savePeers(currentUser.peerId, peers);
  }, [peers, currentUser]);

  const activeMessages = activePeerId ? (messagesMap[activePeerId] ?? []) : [];

  const handleSessionInit = async (payload: SessionInitPayload, senderPeerId: string) => {
    if (!currentUser) return;
    
    // Automatically add the peer if not in the list to accept the session
    let peer = peers.find(p => p.peerId === senderPeerId);
    if (!peer) {
      const profiles = loadProfiles();
      const peerProfile = profiles.find(p => p.peerId === senderPeerId);
      if (peerProfile) {
        const newPeer: Peer = {
          id: `peer-${Date.now()}`,
          name: peerProfile.name,
          peerId: senderPeerId,
          fingerprint: peerProfile.fingerprint,
          status: 'online',
          unreadCount: 0,
        };
        setPeers(prev => [newPeer, ...prev]);
        peer = newPeer;
      } else {
        return;
      }
    }

    // If the peer is re-initiating the session (e.g. they refreshed their page), we MUST accept the new keys
    // to avoid decrypt_errors when they start encrypting with their new sendKey.
    // We overwrite any existing session in memory.

    const localKeys = await getLocalKeyPair(currentUser.id);
    if (!localKeys) return;

    try {
      const ciphertext = base64ToBytes(payload.kemCiphertextBase64);
      const sharedSecret = await decapsulate(ciphertext, localKeys.kem.privateKey);

      const sendInfo = 'send-' + currentUser.peerId;
      const recvInfo = 'send-' + senderPeerId;
      
      const sendKey = await deriveKeyHKDF(sharedSecret, new Uint8Array(32), sendInfo);
      const recvKey = await deriveKeyHKDF(sharedSecret, new Uint8Array(32), recvInfo);

      initSession(payload.conversationId, sendKey, recvKey);
      
      transport.send(`sys-ack-${Date.now()}`, 'SESSION_ACK', currentUser.peerId, senderPeerId, payload.conversationId, { conversationId: payload.conversationId });
      console.log(`[PQC] Session established with ${senderPeerId}`);
    } catch (err) {
      console.error('Failed to initialize session:', err);
    }
  };

  const handleSessionAck = async (_payload: SessionAckPayload, senderPeerId: string) => {
    // Session is already established on our side when we sent INIT
    console.log(`[PQC] Session acknowledged by ${senderPeerId}`);
  };

  const processIncomingMessage = async (
    envelope: EncryptedEnvelope,
    metadata: any,
    senderPeerId: string,
    convId: string
  ): Promise<Message> => {
    // Return a default failed message shell
    const createFailedMsg = (reason: Message['failureReason']): Message => ({
      id: metadata.msgId || `err-${Date.now()}`,
      senderId: metadata.senderId || 'unknown',
      senderPeerId,
      timestamp: metadata.timestamp || Date.now(),
      status: 'decrypt_failed',
      isEncrypted: true,
      failureReason: reason
    });

    if (!currentUser) return createFailedMsg('missing_session');

    // 1. Validate Shape
    if (!envelope || !envelope.iv || envelope.iv.length !== 12) {
      console.debug('[PQC] Invalid IV length');
      return createFailedMsg('decrypt_error');
    }
    if (!envelope.ciphertext || envelope.ciphertext.length === 0) {
      console.debug('[PQC] Empty ciphertext');
      return createFailedMsg('decrypt_error');
    }
    if (!envelope.signature || envelope.signature.byteLength === undefined) {
      console.debug('[PQC] Invalid signature type or missing byteLength');
      return createFailedMsg('invalid_signature');
    }

    // 2. Validate Conversation ID
    const expectedConvId = buildConversationId(currentUser.peerId, senderPeerId);
    if (convId !== expectedConvId) {
      console.debug(`[PQC] convId mismatch. Expected ${expectedConvId}, got ${convId}`);
      return createFailedMsg('invalid_peer');
    }

    // 3. Peer ID validation implicit above and via profile lookup
    const profiles = loadProfiles();
    const senderProfile = profiles.find(p => p.peerId === senderPeerId);
    if (!senderProfile) return createFailedMsg('invalid_peer');

    // 4. Verify Signature First
    const dsaPublicKey = base64ToBytes(senderProfile.dsaPublicKeyBase64);
    const isVerified = await verifyEnvelope(envelope, metadata, dsaPublicKey);
    if (!isVerified) {
      console.debug('[PQC] Signature verification failed');
      return createFailedMsg('invalid_signature');
    }

    // 5. Verify Session and Counter
    const session = getSession(convId);
    if (!session) {
      console.debug('[PQC] Missing session');
      return createFailedMsg('missing_session');
    }

    if (!checkAndAdvanceReceiveCounter(convId, metadata.counter)) {
      console.debug(`[PQC] Counter mismatch. Expected > current`);
      return createFailedMsg('counter_mismatch');
    }

    // 6. Decrypt Payload
    try {
      const plaintext = await decryptPayload(envelope.ciphertext, envelope.iv, session.receiveChain.key);
      const msgData = JSON.parse(plaintext);
      
      console.debug(`[PQC] Decrypt success. Msg ${metadata.msgId}, from ${senderPeerId}, IV: 12b, Ciphertext: ${envelope.ciphertext.length}b`);

      return {
        id: metadata.msgId,
        senderId: metadata.senderId,
        senderPeerId,
        text: msgData.text,
        file: msgData.file,
        timestamp: metadata.timestamp,
        status: 'delivered',
        isEncrypted: true
      };
    } catch (err) {
      console.debug('[PQC] AES decryption failed', err);
      return createFailedMsg('decrypt_error');
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const processedEvents = new Set<string>();

    const handleEvent = async (event: ChannelEvent) => {
      if (event.senderPeerId === currentUser.peerId && event.senderPeerId !== 'system') return;

      const eventId = (event.payload as any)?.messageId || `${event.type}-${event.timestamp}-${event.senderPeerId}`;
      if (processedEvents.has(eventId)) return;
      processedEvents.add(eventId);

      if (event.type === 'SESSION_INIT') {
        await handleSessionInit(event.payload as SessionInitPayload, event.senderPeerId);
      }
      if (event.type === 'SESSION_ACK') {
        await handleSessionAck(event.payload as SessionAckPayload, event.senderPeerId);
      }
      if (event.type === 'MESSAGE_SENT' || event.type === 'FILE_SHARED') {
        const payload = event.payload as any; // envelope structure
        const convId = payload.conversationId;
        const peer = peers.find(p => buildConversationId(currentUser.peerId, p.peerId) === convId);
        
        if (peer) {
          const envelope: EncryptedEnvelope = {
            ciphertext: typeof payload.envelope.ciphertext === 'string' ? base64ToBytes(payload.envelope.ciphertext) : payload.envelope.ciphertext,
            iv: typeof payload.envelope.iv === 'string' ? base64ToBytes(payload.envelope.iv) : payload.envelope.iv,
            signature: typeof payload.envelope.signature === 'string' ? base64ToBytes(payload.envelope.signature) : payload.envelope.signature
          };

          const msg = await processIncomingMessage(envelope, payload.metadata, event.senderPeerId, convId);
          if (msg) {
            setMessagesMap(prev => {
              const currentMsgs = prev[peer.id] || [];
              if (currentMsgs.some(m => m.id === msg.id)) return prev;
              return { ...prev, [peer.id]: [...currentMsgs, msg] };
            });

            setPeers(prev => prev.map(p => {
              if (p.id === peer.id) {
                return {
                  ...p,
                  lastMessage: msg.status === 'decrypt_failed' ? '[Decryption Failed]' : (msg.file ? `📎 ${msg.file.name}` : msg.text),
                  timestamp: msg.timestamp,
                  unreadCount: p.id === activePeerId ? 0 : p.unreadCount + 1,
                };
              }
              return p;
            }));
            saveMessages(convId, [...(messagesMap[peer.id] || []), msg]);

            // Re-establish session if missing or out of sync
            if (msg.status === 'decrypt_failed' && (msg.failureReason === 'missing_session' || msg.failureReason === 'counter_mismatch')) {
               console.debug('[PQC] Re-initiating session with', peer.peerId);
               initiatePqcSession(peer.peerId);
            }
          }
        }
      }
      if (event.type === 'MESSAGE_DELIVERED' as any) {
        const msgId = (event.payload as any).messageId;
        setMessagesMap(prev => {
          const newMap = { ...prev };
          for (const pid in newMap) {
            newMap[pid] = newMap[pid].map(m => m.id === msgId ? { ...m, status: 'delivered' } : m);
            saveMessages(buildConversationId(currentUser.peerId, peers.find(p=>p.id===pid)?.peerId || ''), newMap[pid]);
          }
          return newMap;
        });
      }
      if (event.type === 'MESSAGE_FAILED' as any) {
        const msgId = (event.payload as any).messageId;
        setMessagesMap(prev => {
          const newMap = { ...prev };
          for (const pid in newMap) {
            newMap[pid] = newMap[pid].map(m => m.id === msgId ? { ...m, status: 'delivery_failed' } : m);
            saveMessages(buildConversationId(currentUser.peerId, peers.find(p=>p.id===pid)?.peerId || ''), newMap[pid]);
          }
          return newMap;
        });
      }
      if (event.type === 'USERS_SYNC' as any) {
        const onlineUsers = event.payload as any[];
        onlineUsers.forEach(u => {
          if (u.publicKeys && u.userId !== currentUser.peerId) {
            const profile = u.publicKeys as any;
            if (profile.name) {
              registerProfile(profile);
            }
          }
        });
        setPeers(prev => prev.map(p => {
          if (onlineUsers.some(u => u.userId === p.peerId)) return { ...p, status: 'online' };
          return p;
        }));
      }
      if (event.type === 'USER_ONLINE' as any) {
        const profile = event.payload as any;
        if (profile && profile.name && event.senderPeerId !== currentUser.peerId) {
          registerProfile(profile);
        }
        setPeers(prev => prev.map(p => p.peerId === event.senderPeerId ? { ...p, status: 'online' } : p));
      }
      if (event.type === 'USER_OFFLINE' as any) {
        setPeers(prev => prev.map(p => p.peerId === event.senderPeerId ? { ...p, status: 'offline' } : p));
      }
      if (event.type === 'PRESENCE_PING') {
        setPeers(prev => prev.map(p => p.peerId === (event.payload as any).peerId ? { ...p, status: 'online' } : p));
        transport.send(`sys-pong-${Date.now()}`, 'PRESENCE_PONG', currentUser.peerId, 'broadcast', '', { peerId: currentUser.peerId, name: currentUser.name });
      }
      if (event.type === 'PRESENCE_PONG') {
        setPeers(prev => prev.map(p => p.peerId === (event.payload as any).peerId ? { ...p, status: 'online' } : p));
      }
    };

    const unsub = transport.subscribe(handleEvent);
    return () => unsub();
  }, [currentUser, peers, activePeerId, messagesMap]);

  const initiatePqcSession = async (peerId: string) => {
    if (!currentUser) return false;
    const profiles = loadProfiles();
    const peerProfile = profiles.find(p => p.peerId === peerId);
    if (!peerProfile) return false;

    const localKeys = await getLocalKeyPair(currentUser.id);
    if (!localKeys) return false;

    const kemPubKeyBytes = base64ToBytes(peerProfile.kemPublicKeyBase64);
    const { ciphertext, sharedSecret } = await encapsulate(kemPubKeyBytes);
    
    const convId = buildConversationId(currentUser.peerId, peerId);
    const sendInfo = 'send-' + currentUser.peerId;
    const recvInfo = 'send-' + peerId;
    
    const sendKey = await deriveKeyHKDF(sharedSecret, new Uint8Array(32), sendInfo);
    const recvKey = await deriveKeyHKDF(sharedSecret, new Uint8Array(32), recvInfo);
    
    initSession(convId, sendKey, recvKey);
    
    transport.send(`sys-init-${Date.now()}`, 'SESSION_INIT', currentUser.peerId, peerId, convId, {
      conversationId: convId,
      kemCiphertextBase64: bytesToBase64(ciphertext)
    });
    console.log(`[PQC] Initiated session with ${peerId}`);
    return true;
  };

  const addPeer = useCallback(async (peerId: string, displayName: string) => {
    if (!currentUser) return { ok: false, error: 'invalid' };
    if (peerId === currentUser.peerId) return { ok: false, error: 'self' };
    if (peers.some((p) => p.peerId === peerId)) return { ok: false, error: 'duplicate' };

    const profiles = loadProfiles();
    const peerProfile = profiles.find(p => p.peerId === peerId);
    if (!peerProfile) return { ok: false, error: 'profile_not_found' };

    const newPeer: Peer = {
      id: `peer-${Date.now()}`,
      name: displayName.trim(),
      peerId,
      fingerprint: peerProfile.fingerprint,
      status: 'online',
      unreadCount: 0,
    };

    setPeers(prev => [newPeer, ...prev]);
    setActivePeerId(newPeer.id);
    
    await initiatePqcSession(peerId);

    transport.send(`sys-peer-${Date.now()}`, 'PEER_ADDED', currentUser.peerId, 'broadcast', '', { addedPeerId: peerId });
    return { ok: true };
  }, [currentUser, peers]);

  const sendSecurePayload = async (eventType: 'MESSAGE_SENT' | 'FILE_SHARED', msgPayload: any) => {
    if (!activePeerId || !currentUser) return;
    const peer = peers.find(p => p.id === activePeerId);
    if (!peer) return;

    const convId = buildConversationId(currentUser.peerId, peer.peerId);
    let session = getSession(convId);
    if (!session) {
      console.log('[PQC] Session missing on send, re-initiating automatically...');
      const ok = await initiatePqcSession(peer.peerId);
      session = getSession(convId);
      if (!ok || !session) {
        alert("Cannot send message: PQC Session could not be re-established.");
        return;
      }
    }

    const localKeys = await getLocalKeyPair(currentUser.id);
    if (!localKeys) return;

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = Date.now();
    const counter = advanceSendCounter(convId);

    const plaintext = JSON.stringify(msgPayload);
    const { ciphertext, iv } = await encryptPayload(plaintext, session.sendChain.key);

    const metadata = { msgId, senderId: currentUser.id, timestamp, counter };
    const envelope = await createEnvelope(ciphertext, iv, metadata, localKeys.dsa.privateKey);

    console.debug(`[PQC] Sending secure payload. Msg ${msgId}, Conv ${convId}, To ${peer.peerId}, Counter: ${counter}, IV: ${iv.length}b, Ciphertext: ${ciphertext.length}b, Session OK`);

    // Save locally
    const msg: Message = {
      id: msgId, senderId: currentUser.id, senderPeerId: currentUser.peerId,
      text: msgPayload.text, file: msgPayload.file, timestamp, status: 'sent', isEncrypted: true
    };
    const updatedMsgs = [...activeMessages, msg];
    setMessagesMap(prev => ({ ...prev, [activePeerId]: updatedMsgs }));
    saveMessages(convId, updatedMsgs);

    setPeers(prev => prev.map(p =>
      p.id === activePeerId ? { ...p, lastMessage: msg.file ? `📎 ${msg.file.name}` : msg.text, timestamp } : p
    ));

    transport.send(msgId, eventType, currentUser.peerId, peer.peerId, convId, {
      conversationId: convId,
      metadata,
      envelope: {
        ciphertext: bytesToBase64(envelope.ciphertext),
        iv: bytesToBase64(envelope.iv),
        signature: bytesToBase64(envelope.signature)
      }
    });
  };

  const sendMessage = async (text: string) => {
    await sendSecurePayload('MESSAGE_SENT', { text });
  };

  const sendFileMessage = async (fileAttachment: FileAttachment) => {
    // In a full implementation, you would encrypt the actual file blob in fileStore.
    // The prompt requested this, so ensure fileStore logic utilizes fileCrypto.ts.
    await sendSecurePayload('FILE_SHARED', { file: fileAttachment });
  };

  return (
    <ChatContext.Provider value={{ peers, activePeerId, activeMessages, isLoading, setActivePeerId, addPeer, sendMessage, sendFileMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
}
