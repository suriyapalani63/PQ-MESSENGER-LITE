import { useRef, useEffect } from 'react';
import { Lock, MoreVertical, FileText, Download, ShieldCheck, MessageSquare } from 'lucide-react';
import type { Peer, Message, FileAttachment } from '@/types/messaging';
import { useAuth } from '@/contexts/AuthContext';
import { getFile } from '@/services/fileStore';
import { clsx } from 'clsx';
import { getSession } from '@/crypto/sessionStore';
import { buildConversationId } from '@/services/messagingService';

interface ChatAreaProps {
  activePeer: Peer | null;
  messages: Message[];
  onOpenSecurityDetails: () => void;
}

export function ChatArea({ activePeer, messages, onOpenSecurityDetails }: ChatAreaProps) {
  const { currentUser, connectionStatus } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleDownload = async (file: FileAttachment) => {
    try {
      const stored = await getFile(file.fileId);
      if (!stored) {
        alert('File not found in local store. It may have been deleted or not synced.');
        return;
      }
      const url = URL.createObjectURL(stored.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = stored.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Failed to download file:', err);
      alert('Error downloading file.');
    }
  };

  // ── No peer selected ────────────────────────────────────────────
  if (!activePeer) {
    return (
      <div className="flex-1 bg-bg-base flex flex-col items-center justify-center bg-grid-pattern">
        <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-6 neon-glow">
          <ShieldCheck className="w-10 h-10 text-neon-blue" />
        </div>
        <h2 className="text-2xl font-bold text-text-main mb-2">Secure Messaging</h2>
        <p className="text-text-sec text-center max-w-md">
          Select a peer or start a new secure conversation.
        </p>
        <p className="text-text-sec/50 text-xs mt-4 max-w-sm text-center">
          This is a cross-tab UI demo. Open a new tab to simulate another user.
        </p>
      </div>
    );
  }

  const isOnline = activePeer.status === 'online';
  const convId = currentUser ? buildConversationId(currentUser.peerId, activePeer.peerId) : '';
  const session = getSession(convId);

  let networkStatusStr = '';
  if (connectionStatus === 'connecting') networkStatusStr = 'Connecting...';
  else if (connectionStatus === 'error') networkStatusStr = 'Connection Error';
  else if (connectionStatus === 'disconnected') networkStatusStr = 'Disconnected';
  else if (connectionStatus === 'connected' || connectionStatus === 'registered') networkStatusStr = 'Connected';
  else networkStatusStr = connectionStatus;

  return (
    <div className="flex-1 bg-bg-base flex flex-col relative bg-grid-pattern min-h-0">
      {/* Header */}
      <div className="h-20 bg-bg-sidebar/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-text-main font-bold text-lg border border-white/10">
              {activePeer.name.charAt(0).toUpperCase()}
            </div>
            <div
              className={clsx(
                'absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-bg-sidebar',
                isOnline ? 'bg-success' : 'bg-slate-500',
              )}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              {activePeer.name}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-sec font-mono">{activePeer.peerId}</span>
              {networkStatusStr && (
                <>
                  <span className="text-white/20">•</span>
                  <span className={clsx(
                    connectionStatus === 'error' || connectionStatus === 'disconnected' ? 'text-red-400' : 'text-text-sec'
                  )}>
                    {networkStatusStr}
                  </span>
                </>
              )}
              <span className="text-white/20">•</span>
              {session ? (
                <span className="flex items-center gap-1 text-success font-medium">
                  <Lock className="w-3 h-3" />
                  PQC session: Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 text-text-sec">
                  <Lock className="w-3 h-3" />
                  PQC session establishing
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onOpenSecurityDetails}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-neon-blue border border-primary/30 transition-colors text-sm font-medium"
          >
            <ShieldCheck className="w-4 h-4" />
            Security details
          </button>
          <button className="text-text-sec hover:text-text-main p-2">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <MessageSquare className="w-7 h-7 text-text-sec/40" />
            </div>
            <p className="text-text-sec text-sm font-medium mb-1">No messages yet</p>
            <p className="text-text-sec/50 text-xs">
              Send your first message to {activePeer.name}.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = currentUser ? msg.senderId === currentUser.id : false;
            return (
              <div
                key={msg.id}
                className={clsx(
                  'flex flex-col max-w-[70%]',
                  isSelf ? 'ml-auto items-end' : 'mr-auto items-start',
                )}
              >
                <div
                  className={clsx(
                    'p-4 rounded-2xl shadow-lg relative',
                    (msg.status === 'decrypt_failed' || msg.status === 'delivery_failed')
                      ? 'bg-red-950/50 border border-red-500/50 text-red-200 ' + (isSelf ? 'rounded-tr-sm' : 'rounded-tl-sm')
                      : isSelf
                        ? 'bg-gradient-to-br from-primary to-blue-700 text-white rounded-tr-sm neon-glow'
                        : 'bg-bg-card border border-white/10 text-text-main rounded-tl-sm',
                  )}
                >
                  {msg.status === 'delivery_failed' ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-[15px] font-medium">[Delivery Failed]</p>
                      <p className="text-xs text-red-400 opacity-80">Recipient is offline</p>
                      {msg.text && <p className="text-sm mt-2 opacity-70 line-through">{msg.text}</p>}
                    </div>
                  ) : msg.status === 'decrypt_failed' ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-[15px] font-medium">[Decryption Failed]</p>
                      <p className="text-xs text-red-400 opacity-80">{msg.failureReason}</p>
                    </div>
                  ) : msg.text && (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                  )}

                  {msg.file && (
                    <div className="mt-3 p-3 bg-black/20 rounded-xl border border-white/10 flex items-center gap-4 min-w-[250px]">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-neon-blue shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{msg.file.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-white/60 mt-1 uppercase tracking-wider">
                          <span>{msg.file.size}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => msg.file && handleDownload(msg.file)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-neon-blue shrink-0"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2 px-1">
                  <span className="text-[11px] text-text-sec">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.isEncrypted && (
                    <span className="flex items-center gap-1 text-[10px] text-success/80 uppercase tracking-wider font-semibold">
                      <Lock className="w-3 h-3" /> Encrypted
                    </span>
                  )}
                  {isSelf && msg.status !== 'delivery_failed' && msg.status !== 'decrypt_failed' && (
                    <span className="text-[10px] text-neon-blue/80 uppercase tracking-wider font-semibold">
                      {msg.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
