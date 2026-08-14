/**
 * oqsAdapter.ts — Wrapper for @oqs/liboqs-js
 * 
 * Safely manages WASM initialization and algorithm lifecycles.
 * Ensures instances are destroyed after use to prevent memory leaks.
 */

import { createMLKEM768, createMLDSA65 } from '@oqs/liboqs-js';

export interface OQSKEMKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface OQSSigKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface KEMSharedSecret {
  sharedSecret: Uint8Array;
  ciphertext: Uint8Array;
}

export async function initOQS(): Promise<void> {
  // Initialization is handled by the factories internally, so this can be a no-op 
  // or a simple test load to warm up WASM.
  const kem = await createMLKEM768();
  kem.destroy();
}

// ── KEM (Key Encapsulation Mechanism) ────────────────────────────────────────

export async function generateKEMKeyPair(): Promise<OQSKEMKeyPair> {
  const kem = await createMLKEM768();
  try {
    const { publicKey, secretKey } = kem.generateKeyPair();
    return { publicKey: new Uint8Array(publicKey), privateKey: new Uint8Array(secretKey) };
  } finally {
    kem.destroy();
  }
}

export async function encapsulate(publicKey: Uint8Array): Promise<KEMSharedSecret> {
  const kem = await createMLKEM768();
  try {
    const { ciphertext, sharedSecret } = kem.encapsulate(publicKey);
    return { 
      ciphertext: new Uint8Array(ciphertext), 
      sharedSecret: new Uint8Array(sharedSecret) 
    };
  } finally {
    kem.destroy();
  }
}

export async function decapsulate(ciphertext: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  const kem = await createMLKEM768();
  try {
    const sharedSecret = kem.decapsulate(ciphertext, privateKey);
    return new Uint8Array(sharedSecret);
  } finally {
    kem.destroy();
  }
}

// ── Signature (Digital Signatures) ──────────────────────────────────────────

export async function generateSigKeyPair(): Promise<OQSSigKeyPair> {
  const sig = await createMLDSA65();
  try {
    const { publicKey, secretKey } = sig.generateKeyPair();
    return { publicKey: new Uint8Array(publicKey), privateKey: new Uint8Array(secretKey) };
  } finally {
    sig.destroy();
  }
}

export async function sign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  const sig = await createMLDSA65();
  try {
    const signature = sig.sign(message, privateKey);
    return new Uint8Array(signature);
  } finally {
    sig.destroy();
  }
}

export async function verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
  const sig = await createMLDSA65();
  try {
    return sig.verify(message, signature, publicKey);
  } catch (err) {
    console.error('Signature verification threw an error:', err);
    return false;
  } finally {
    sig.destroy();
  }
}
