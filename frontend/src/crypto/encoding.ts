/**
 * encoding.ts — Binary-to-text encoding and fingerprint derivation
 * 
 * Includes Base64 and Hex encoding for transporting binary data over BroadcastChannel/localStorage.
 */

export function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Derives a deterministic cryptographic fingerprint:
 * SHA-256( ML-KEM PublicKey || ML-DSA PublicKey )
 * Formats as colon-separated hex for readability.
 */
export async function deriveFingerprint(kemPubKey: Uint8Array, dsaPubKey: Uint8Array): Promise<string> {
  const combined = new Uint8Array(kemPubKey.length + dsaPubKey.length);
  combined.set(kemPubKey, 0);
  combined.set(dsaPubKey, kemPubKey.length);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  return hashArray
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':')
    .slice(0, 47); // Optional: truncate to a readable length like 16 bytes (47 chars with colons)
}
