/**
 * AuthContext — manages the current user's profile and crypto keys.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { UserProfile, PublicProfile } from '@/types/messaging';
import type { CryptoStatus, PQCKeyPair } from '@/types/crypto';
import {
  loadCurrentUser,
  saveCurrentUser,
  clearCurrentUser,
  generatePeerId,
  registerProfile,
  unregisterProfile,
} from '@/services/messagingService';
import { transport } from '@/services/transport';
import { runCryptoSelfTest } from '@/crypto/selfTest';
import { generateKEMKeyPair, generateSigKeyPair } from '@/crypto/oqsAdapter';
import { storeLocalKeyPair, deleteLocalKeyPair, getLocalKeyPair } from '@/crypto/keyStore';
import { bytesToBase64, deriveFingerprint } from '@/crypto/encoding';

interface AuthContextValue {
  currentUser: UserProfile | null;
  isLoading: boolean;
  cryptoStatus: CryptoStatus;
  connectionStatus: string;
  createProfile: (displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cryptoStatus, setCryptoStatus] = useState<CryptoStatus>('initializing');
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');

  useEffect(() => {
    return transport.onConnectionChange((status) => {
      setConnectionStatus(status);
    });
  }, []);

  // Initialization: Run self-test, load user
  useEffect(() => {
    async function init() {
      const isCryptoReady = await runCryptoSelfTest();
      if (!isCryptoReady) {
        setCryptoStatus('failed');
        setIsLoading(false);
        return;
      }
      setCryptoStatus('ready');

      const stored = loadCurrentUser();
      if (stored) {
        // Only load if keys are intact
        const keys = await getLocalKeyPair(stored.id);
        if (keys) {
          setCurrentUser(stored);
          const publicProfile: PublicProfile = {
            peerId: stored.peerId,
            name: stored.name,
            fingerprint: stored.fingerprint,
            kemPublicKeyBase64: bytesToBase64(keys.kem.publicKey),
            dsaPublicKeyBase64: bytesToBase64(keys.dsa.publicKey)
          };
          registerProfile(publicProfile);
          transport.connect(stored.peerId, {
            kemPublicKeyBase64: publicProfile.kemPublicKeyBase64,
            dsaPublicKeyBase64: publicProfile.dsaPublicKeyBase64
          });
        } else {
          clearCurrentUser();
        }
      }
      setIsLoading(false);
    }
    init();
  }, []);

  const createProfile = useCallback(async (displayName: string) => {
    if (cryptoStatus !== 'ready') {
      alert('Cryptography module is not ready.');
      return;
    }

    const userId = `user-${Date.now()}`;
    const kemKeys = await generateKEMKeyPair();
    const dsaKeys = await generateSigKeyPair();

    const keyPair: PQCKeyPair = { kem: kemKeys, dsa: dsaKeys };
    await storeLocalKeyPair(userId, keyPair);

    const fingerprint = await deriveFingerprint(kemKeys.publicKey, dsaKeys.publicKey);
    
    const profile: UserProfile = {
      id: userId,
      name: displayName.trim(),
      peerId: generatePeerId(),
      fingerprint,
      createdAt: Date.now(),
    };
    saveCurrentUser(profile);
    setCurrentUser(profile);

    const publicProfile: PublicProfile = {
      peerId: profile.peerId,
      name: profile.name,
      fingerprint: profile.fingerprint,
      kemPublicKeyBase64: bytesToBase64(kemKeys.publicKey),
      dsaPublicKeyBase64: bytesToBase64(dsaKeys.publicKey)
    };
    registerProfile(publicProfile);
    
    transport.connect(profile.peerId, {
      kemPublicKeyBase64: publicProfile.kemPublicKeyBase64,
      dsaPublicKeyBase64: publicProfile.dsaPublicKeyBase64
    });

    transport.send(`msg-${Date.now()}`, 'PROFILE_CREATED', profile.peerId, 'broadcast', '', { profile: publicProfile });
  }, [cryptoStatus]);

  const logout = useCallback(async () => {
    if (currentUser) {
      unregisterProfile(currentUser.peerId);
      await deleteLocalKeyPair(currentUser.id);
      transport.disconnect();
    }
    clearCurrentUser();
    setCurrentUser(null);
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, cryptoStatus, connectionStatus, createProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
