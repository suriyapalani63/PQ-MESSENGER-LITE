import { io, Socket } from 'socket.io-client';
import type { ChannelEvent, ChannelEventType, PublicProfile } from '@/types/messaging';

const SOCKET_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

type EventHandler = (event: ChannelEvent) => void;
type ConnectionHandler = (status: 'disconnected' | 'connecting' | 'connected' | 'registered' | 'error') => void;

class SocketClient {
  private socket: Socket | null = null;
  private handlers: EventHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  
  private currentUserId: string | null = null;
  private currentPublicKeys: any = null;

  connect(userId: string, publicProfile: PublicProfile) {
    this.currentUserId = userId;
    this.currentPublicKeys = publicProfile;

    if (!this.socket) {
      this.updateStatus('connecting');
      this.socket = io(SOCKET_URL, {
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 20000,
      });

      this.setupListeners();
    } else {
      if (this.socket.connected) {
        this.register();
      } else {
        this.socket.connect();
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentUserId = null;
    this.currentPublicKeys = null;
    this.updateStatus('disconnected');
  }

  private register() {
    if (!this.socket || !this.currentUserId || !this.currentPublicKeys) return;
    this.socket.emit('register', {
      userId: this.currentUserId,
      publicKeys: this.currentPublicKeys
    });
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[socket] connected', this.socket?.id, this.socket?.io?.engine?.transport?.name);
      this.updateStatus('connected');
      this.register(); // Re-register on every connect/reconnect
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[socket] disconnected', reason);
      this.updateStatus('disconnected');
    });

    this.socket.on('connect_error', (err: any) => {
      console.error('[socket] connect_error', err.message);
      this.updateStatus('error');
    });

    this.socket.on('registered', (data: any) => {
      this.updateStatus('registered');
      console.log('[Socket] Registered successfully.', data);
      if (data.onlineUsers) {
        this.dispatch({
          type: 'USERS_SYNC' as any,
          senderPeerId: 'system',
          timestamp: Date.now(),
          payload: data.onlineUsers
        });
      }
    });

    this.socket.on('receive-message', (message: any) => {
      // Map to internal ChannelEvent
      const event: ChannelEvent = {
        type: message.type as ChannelEventType,
        senderPeerId: message.sender,
        timestamp: message.timestamp || Date.now(),
        payload: message.payload,
      };
      this.dispatch(event);
    });

    this.socket.on('message-delivered', (data: { messageId: string, timestamp: number }) => {
      this.dispatch({
        type: 'MESSAGE_DELIVERED' as any,
        senderPeerId: 'system',
        timestamp: data.timestamp,
        payload: { messageId: data.messageId }
      });
    });

    this.socket.on('message-failed', (data: { messageId: string, reason: string }) => {
      this.dispatch({
        type: 'MESSAGE_FAILED' as any,
        senderPeerId: 'system',
        timestamp: Date.now(),
        payload: { messageId: data.messageId, reason: data.reason }
      });
    });

    this.socket.on('user-online', (data: { userId: string, publicKeys: any }) => {
      this.dispatch({
        type: 'USER_ONLINE' as any,
        senderPeerId: data.userId,
        timestamp: Date.now(),
        payload: data.publicKeys
      });
    });

    this.socket.on('user-offline', (data: { userId: string }) => {
      this.dispatch({
        type: 'USER_OFFLINE' as any,
        senderPeerId: data.userId,
        timestamp: Date.now(),
        payload: null
      });
    });
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler);
    };
  }

  private dispatch(event: ChannelEvent) {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[SocketClient] Handler error:', err);
      }
    }
  }

  private updateStatus(status: Parameters<ConnectionHandler>[0]) {
    for (const handler of this.connectionHandlers) {
      handler(status);
    }
  }

  send(messageId: string, type: string, recipient: string, conversationId: string, payload: any) {
    if (!this.socket || !this.socket.connected) {
      console.warn('[SocketClient] Cannot send, socket not connected.');
      return;
    }
    this.socket.emit('send-message', {
      id: messageId,
      sender: this.currentUserId,
      recipient,
      type,
      conversationId,
      payload,
      timestamp: Date.now()
    });
  }
}

export const socketClient = new SocketClient();
