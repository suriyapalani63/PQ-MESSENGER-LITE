/**
 * PeerIdModal — shows the current user's Peer ID and demo fingerprint.
 * Now reads from AuthContext instead of accepting a static prop.
 */

import { useState } from 'react';
import { UserCircle, X, Copy, Check, QrCode } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PeerIdModalProps {
  onClose: () => void;
}

export function PeerIdModal({ onClose }: PeerIdModalProps) {
  const { currentUser } = useAuth();
  const [copiedField, setCopiedField] = useState<'peerId' | 'fingerprint' | null>(null);

  if (!currentUser) return null;

  const handleCopy = (text: string, field: 'peerId' | 'fingerprint') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-sidebar border border-border-neon rounded-2xl w-full max-w-md overflow-hidden shadow-2xl neon-glow">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-neon-blue">
              <UserCircle className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text-main">My Peer ID</h2>
          </div>
          <button onClick={onClose} className="p-2 text-text-sec hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col items-center">
          <div className="w-40 h-40 bg-white p-2 rounded-xl mb-6 shadow-[0_0_30px_rgba(0,183,255,0.2)]">
            {/* Placeholder QR Code */}
            <div className="w-full h-full border-4 border-black border-dashed flex items-center justify-center">
              <QrCode className="w-16 h-16 text-black" />
            </div>
          </div>

          <p className="text-sm text-text-sec text-center mb-6 max-w-[280px]">
            Share your Peer ID with trusted contacts to start a secure conversation.
          </p>

          <div className="w-full space-y-4">
            {/* Peer ID */}
            <div className="bg-bg-card border border-white/10 rounded-xl p-4 flex justify-between items-center group">
              <div>
                <p className="text-[10px] text-text-sec uppercase tracking-widest mb-1">Current Peer ID</p>
                <p className="text-lg font-mono font-semibold text-text-main">{currentUser.peerId}</p>
              </div>
              <button
                onClick={() => handleCopy(currentUser.peerId, 'peerId')}
                className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-text-sec hover:text-neon-blue hover:bg-primary/20 transition-all"
              >
                {copiedField === 'peerId' ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Key Fingerprint */}
            <div className="bg-bg-card border border-white/10 rounded-xl p-4 flex justify-between items-center group">
              <div>
                <p className="text-[10px] text-text-sec uppercase tracking-widest mb-1">
                  Key Fingerprint
                </p>
                <p className="text-sm font-mono text-primary">{currentUser.fingerprint}</p>
              </div>
              <button
                onClick={() => handleCopy(currentUser.fingerprint, 'fingerprint')}
                className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-text-sec hover:text-neon-blue hover:bg-primary/20 transition-all"
              >
                {copiedField === 'fingerprint' ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] text-text-sec/60 text-center mt-6 max-w-[280px]">
            This fingerprint is derived from your real ML-KEM and ML-DSA public keys using SHA-256.
          </p>
        </div>
      </div>
    </div>
  );
}
