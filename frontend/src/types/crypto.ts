/**
 * types/crypto.ts — Cryptography definitions
 */

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface PQCKeyPair {
  kem: KeyPair;
  dsa: KeyPair;
}

export interface PQCPublicKeys {
  kemPublicKey: Uint8Array;
  dsaPublicKey: Uint8Array;
}

export interface EncryptedEnvelope {
  /** The AES-256-GCM ciphertext */
  ciphertext: Uint8Array;
  /** The initialization vector used for AES */
  iv: Uint8Array;
  /** The ML-DSA signature over the canonicalized (ciphertext, iv, metadata) */
  signature: Uint8Array;
}

export interface KEMCiphertext {
  ciphertext: Uint8Array;
}

export type CryptoStatus = 'initializing' | 'ready' | 'failed';
