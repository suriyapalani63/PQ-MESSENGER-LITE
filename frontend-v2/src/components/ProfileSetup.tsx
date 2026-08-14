/**
 * ProfileSetup — First-run screen for creating a local user profile.
 *
 * ⚠️  LOCAL PROTOTYPE ONLY.
 *   • The generated Peer ID and fingerprint are random demo data.
 *   • No real cryptographic key material is created.
 */

import { useState } from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function ProfileSetup() {
  const { createProfile } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Display name cannot be empty.');
      return;
    }
    if (trimmed.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 32) {
      setError('Display name must be 32 characters or fewer.');
      return;
    }
    setError(null);
    createProfile(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
  };

  return (
    <div className="flex h-screen bg-bg-base text-text-main font-sans items-center justify-center bg-grid-pattern min-w-[1200px]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary flex items-center justify-center mb-4 neon-glow">
            <ShieldCheck className="w-9 h-9 text-neon-blue" />
          </div>
          <h1 className="text-3xl font-bold tracking-wide">PQ MESSENGER LITE</h1>
          <p className="text-sm text-text-sec mt-2 tracking-widest uppercase">
            Local Prototype · UI-Only
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-sidebar border border-border-neon rounded-2xl overflow-hidden shadow-2xl neon-glow">
          <div className="p-8">
            <h2 className="text-xl font-bold mb-1">Create Your Profile</h2>
            <p className="text-sm text-text-sec mb-6">
              A unique Peer ID and demo fingerprint will be generated for you.
            </p>

            <label className="block text-sm font-medium text-text-sec mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter your name"
              autoFocus
              className="w-full bg-bg-card border border-white/10 rounded-xl px-4 py-3 text-text-main placeholder-text-sec focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
            />

            {error && (
              <div className="flex items-center gap-2 mt-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              className="w-full mt-6 py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all neon-glow hover:neon-glow-active tracking-wide"
            >
              CREATE PROFILE
            </button>
          </div>

          {/* Footer disclaimer */}
          <div className="px-8 py-4 bg-bg-base/50 border-t border-white/5">
            <p className="text-[11px] text-text-sec text-center leading-relaxed">
              This is a local frontend prototype. Cross-browser messaging,
              ML-KEM encryption, and real peer authentication are not yet
              implemented.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
