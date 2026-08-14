import { useState, useEffect } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { isValidPeerId, loadProfiles } from '@/services/messagingService';
import type { PublicProfile } from '@/types/messaging';

interface NewChatModalProps {
  onClose: () => void;
}

export function NewChatModal({ onClose }: NewChatModalProps) {
  const { addPeer } = useChat();
  const { currentUser } = useAuth();
  const [peerId, setPeerId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<PublicProfile[]>([]);

  useEffect(() => {
    // Load other public profiles available in the registry
    if (currentUser) {
      const profiles = loadProfiles().filter(p => p.peerId !== currentUser.peerId);
      setAvailableProfiles(profiles);
    }
  }, [currentUser]);

  const handleSubmit = async () => {
    setError(null);

    const trimmedName = displayName.trim();
    const trimmedPeerId = peerId.trim().toUpperCase();

    // ── Validation ────────────────────────────────────────────────
    if (!trimmedName) {
      setError('Display name cannot be empty.');
      return;
    }
    if (!trimmedPeerId) {
      setError('Peer ID cannot be empty.');
      return;
    }
    if (!isValidPeerId(trimmedPeerId)) {
      setError('Invalid Peer ID format. Expected PQ-XXXX-XXXX (hex).');
      return;
    }

    const result = await addPeer(trimmedPeerId, trimmedName);

    if (!result.ok) {
      switch (result.error) {
        case 'self':
          setError('You cannot add your own Peer ID.');
          break;
        case 'duplicate':
          setError('This Peer ID has already been added.');
          break;
        default:
          setError('Failed to add peer. Please try again.');
      }
      return;
    }

    onClose();
  };

  const handleSelectProfile = (profile: PublicProfile) => {
    setPeerId(profile.peerId);
    setDisplayName(profile.name);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-sidebar border border-border-neon rounded-2xl w-full max-w-md overflow-hidden shadow-2xl neon-glow">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-neon-blue">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text-main">Start a Secure Conversation</h2>
          </div>
          <button onClick={onClose} className="p-2 text-text-sec hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {availableProfiles.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-text-sec mb-2">Available Demo Users (Cross-tab)</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {availableProfiles.map((p) => (
                  <button
                    key={p.peerId}
                    onClick={() => handleSelectProfile(p)}
                    className="w-full flex items-center gap-3 p-3 bg-bg-card border border-white/5 hover:border-neon-blue/50 rounded-xl transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-main truncate">{p.name}</div>
                      <div className="text-[10px] text-text-sec font-mono">{p.peerId}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-text-sec mb-2">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setError(null);
              }}
              placeholder="Enter peer's display name"
              className="w-full bg-bg-card border border-white/10 rounded-xl px-4 py-3 text-text-main placeholder-text-sec focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
            />
          </div>

          {/* Peer ID */}
          <div>
            <label className="block text-sm font-medium text-text-sec mb-2">Peer ID</label>
            <input
              type="text"
              value={peerId}
              onChange={(e) => {
                setPeerId(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="PQ-XXXX-XXXX"
              className="w-full bg-bg-card border border-white/10 rounded-xl px-4 py-3 text-text-main font-mono placeholder-text-sec focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all uppercase"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Info */}
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
            <p className="text-xs text-text-sec leading-relaxed">
              In this cross-tab demo, you can auto-fill users from other tabs above, or manually 
              enter a Peer ID. Real device-to-device messaging will require the backend.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-bg-base/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-white/5 text-white font-semibold hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors neon-glow"
          >
            Start secure chat
          </button>
        </div>
      </div>
    </div>
  );
}
