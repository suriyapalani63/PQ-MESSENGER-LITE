/**
 * protocol.ts — Cryptographic Protocol Implementation
 * 
 * Defines HKDF, AES-256-GCM message encryption, and signature workflows.
 */

import { encodeForSigning } from './canonical';
import { sign, verify } from './oqsAdapter';
import type { EncryptedEnvelope } from '@/types/crypto';

// ── HKDF ─────────────────────────────────────────────────────────────────

/**
 * Derives a cryptographic key using HKDF-SHA-256.
 * @param ikm Input Keying Material (e.g. KEM shared secret)
 * @param salt Optional salt
 * @param info Application specific info string (e.g., "Alice-to-Bob")
 * @param length Expected output length in bytes (32 for AES-256)
 */
export async function deriveKeyHKDF(
  ikm: Uint8Array,
  salt: Uint8Array = new Uint8Array(32),
  info: string = 'pq-messenger-session',
  length: number = 32
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ikm as unknown as BufferSource,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const infoBuffer = new TextEncoder().encode(info);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as unknown as BufferSource,
      info: infoBuffer
    },
    keyMaterial,
    length * 8
  );

  return new Uint8Array(derivedBits);
}

// ── AES-256-GCM ──────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 */
export async function encryptPayload(plaintext: string, keyBytes: Uint8Array): Promise<{ ciphertext: Uint8Array, iv: Uint8Array }> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoded
  );

  return { ciphertext: new Uint8Array(ciphertextBuffer), iv };
}

/**
 * Decrypts AES-256-GCM ciphertext back to string.
 */
export async function decryptPayload(ciphertext: Uint8Array, iv: Uint8Array, keyBytes: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource
  );

  return new TextDecoder().decode(plaintextBuffer);
}

// ── Authenticated Envelopes ──────────────────────────────────────────────

export async function createEnvelope(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  metadata: any,
  dsaPrivateKey: Uint8Array
): Promise<EncryptedEnvelope> {
  // We sign the canonical representation of { ciphertext, iv, metadata }
  const payloadToSign = {
    c: Array.from(ciphertext),
    i: Array.from(iv),
    m: metadata
  };

  const encodedBytes = encodeForSigning(payloadToSign);
  const signature = await sign(encodedBytes, dsaPrivateKey);

  return {
    ciphertext,
    iv,
    signature
  };
}

export async function verifyEnvelope(
  envelope: EncryptedEnvelope,
  metadata: any,
  dsaPublicKey: Uint8Array
): Promise<boolean> {
  const payloadToVerify = {
    c: Array.from(envelope.ciphertext),
    i: Array.from(envelope.iv),
    m: metadata
  };

  const encodedBytes = encodeForSigning(payloadToVerify);
  return await verify(encodedBytes, envelope.signature, dsaPublicKey);
}
