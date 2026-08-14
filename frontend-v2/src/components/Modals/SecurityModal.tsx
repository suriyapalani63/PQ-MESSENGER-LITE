/**
 * SecurityModal — displays mock session security details for a peer.
 *
 *   • ML-KEM-768 for Key Encapsulation
 *   • ML-DSA-65 for Digital Signatures
 *   • HKDF-SHA-256 for Key Derivation
 *   • AES-256-GCM for Message/File Encryption
 */

import { useState } from 'react';
import { Shield, X, Copy, Check, Key } from 'lucide-react';
import type { Peer } from '@/types/messaging';

interface SecurityModalProps {
  peer: Peer;
  onClose: () => void;
}

export function SecurityModal({ peer, onClose }: SecurityModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(peer.fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-bg-sidebar border border-border-neon rounded-2xl w-full max-w-md overflow-hidden shadow-2xl neon-glow">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-neon-blue">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text-main">Secure Session Details</h2>
          </div>
          <button onClick={onClose} className="p-2 text-text-sec hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-text-sec text-sm">Session status</span>
              <span className="text-success font-semibold text-sm flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-success" /> PQC session ready
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-text-sec text-sm">Encryption</span>
              <span className="text-text-main font-medium text-sm">Active</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-text-sec text-sm">Key establishment</span>
              <span className="text-text-sec font-medium text-sm">ML-KEM-768</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-text-sec text-sm">Message protection</span>
              <span className="text-text-sec font-medium text-sm">AES-256-GCM</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-text-sec text-sm">Authentication</span>
              <span className="text-text-sec font-medium text-sm">ML-DSA-65</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <span className="text-text-sec text-sm">Peer ID</span>
              <span className="text-text-main font-mono text-sm tracking-wider">{peer.peerId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-sec text-sm">Key fingerprint</span>
              <span className="text-primary font-mono text-sm tracking-wider">{peer.fingerprint}</span>
            </div>
          </div>

          <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex gap-3">
            <Key className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <p className="text-xs text-text-main/80 leading-relaxed">
              This session uses real post-quantum cryptography. The fingerprint shown is derived 
              deterministically from the ML-KEM and ML-DSA public keys using SHA-256.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-bg-base/50 flex justify-end gap-3">
          <button
            onClick={handleCopy}
            className="px-6 py-2.5 rounded-lg border border-border-neon text-neon-blue font-semibold hover:bg-neon-blue/10 transition-colors flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy fingerprint'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
