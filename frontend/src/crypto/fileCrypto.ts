/**
 * fileCrypto.ts — Client-side File Encryption
 * 
 * Encrypts and decrypts File Blobs before storing them in IndexedDB.
 */

import { deriveKeyHKDF } from './protocol';
import { bytesToBase64, base64ToBytes } from './encoding';

export async function encryptFileBlob(
  file: Blob,
  sharedSecret: Uint8Array
): Promise<{ encryptedBlob: Blob; ivBase64: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  
  // Derive a distinct key for file encryption using a different info string
  const fileKey = await deriveKeyHKDF(sharedSecret, new Uint8Array(32), 'pq-messenger-file');
  
  const key = await crypto.subtle.importKey(
    'raw',
    fileKey as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    fileBytes as unknown as BufferSource
  );
  
  return {
    encryptedBlob: new Blob([ciphertextBuffer], { type: 'application/octet-stream' }),
    ivBase64: bytesToBase64(iv)
  };
}

export async function decryptFileBlob(
  encryptedBlob: Blob,
  ivBase64: string,
  sharedSecret: Uint8Array,
  originalMimeType: string
): Promise<Blob> {
  const arrayBuffer = await encryptedBlob.arrayBuffer();
  const ciphertextBytes = new Uint8Array(arrayBuffer);
  
  const fileKey = await deriveKeyHKDF(sharedSecret, new Uint8Array(32), 'pq-messenger-file');
  
  const key = await crypto.subtle.importKey(
    'raw',
    fileKey as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const iv = base64ToBytes(ivBase64);
  
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ciphertextBytes as unknown as BufferSource
  );
  
  return new Blob([plaintextBuffer], { type: originalMimeType });
}
