import { useState } from 'react';
import { Search, Plus, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { useChat } from '@/contexts/ChatContext';

interface ConversationListProps {
  activePeerId: string | null;
  onSelectPeer: (peerId: string) => void;
  onNewChat: () => void;
}

export function ConversationList({ activePeerId, onSelectPeer, onNewChat }: ConversationListProps) {
  const { peers } = useChat();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPeers = peers.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.peerId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="w-[350px] bg-bg-base border-r border-border-neon flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-main">Conversations</h2>
        </div>

        <button
          onClick={onNewChat}
          className="w-full bg-primary/10 hover:bg-primary/20 text-neon-blue border border-primary/30 hover:border-primary/50 py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 neon-glow hover:neon-glow-active text-sm font-semibold tracking-wide"
        >
          <Plus className="w-4 h-4" />
          NEW SECURE CHAT
        </button>

        <div className="mt-6 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-text-sec" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or Peer ID"
            className="w-full bg-bg-card border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-text-main placeholder-text-sec focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredPeers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <MessageSquare className="w-7 h-7 text-text-sec/50" />
            </div>
            <p className="text-text-sec text-sm font-medium mb-1">
              {peers.length === 0 ? 'No conversations yet' : 'No results found'}
            </p>
            <p className="text-text-sec/60 text-xs max-w-[200px]">
              {peers.length === 0
                ? 'Tap "New Secure Chat" to add a peer.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          filteredPeers.map((peer) => {
            const isActive = activePeerId === peer.id;
            return (
              <button
                key={peer.id}
                onClick={() => onSelectPeer(peer.id)}
                className={clsx(
                  'w-full flex items-start gap-4 p-4 rounded-2xl transition-all duration-200 text-left border',
                  isActive
                    ? 'bg-primary/10 border-primary/30 neon-glow'
                    : 'bg-bg-card border-transparent hover:border-white/10',
                )}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-text-main font-bold text-lg border border-white/10">
                    {peer.name.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={clsx(
                      'absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-bg-card',
                      peer.status === 'online' ? 'bg-success' : 'bg-slate-500',
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-text-main truncate">{peer.name}</h3>
                    {peer.timestamp && (
                      <span className="text-xs text-text-sec shrink-0">
                        {formatDistanceToNow(peer.timestamp, { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-text-sec font-mono tracking-wider mb-1">
                    {peer.peerId}
                  </div>
                  <p className="text-sm text-text-sec truncate">
                    {peer.lastMessage ?? 'No messages yet'}
                  </p>
                </div>

                {peer.unreadCount > 0 && (
                  <div className="shrink-0 w-5 h-5 rounded-full bg-neon-blue flex items-center justify-center text-[10px] font-bold text-bg-base mt-2">
                    {peer.unreadCount}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
