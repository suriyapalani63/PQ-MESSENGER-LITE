/**
 * canonical.ts — Deterministic JSON Serialization
 * 
 * Used for creating a consistent byte representation of metadata
 * and ciphertext before signing with ML-DSA to ensure signatures
 * are deterministic and verify correctly across different JavaScript engines.
 */

/**
 * Deterministically stringifies an object by sorting its keys.
 */
export function canonicalize(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    const arr = obj.map((item) => canonicalize(item));
    return `[${arr.join(',')}]`;
  }

  const keys = Object.keys(obj).sort();
  const serialized = keys.map((key) => {
    return `${JSON.stringify(key)}:${canonicalize(obj[key])}`;
  });

  return `{${serialized.join(',')}}`;
}

/**
 * Convert a canonicalized string into a Uint8Array for signing.
 */
export function encodeForSigning(payload: any): Uint8Array {
  const jsonStr = canonicalize(payload);
  return new TextEncoder().encode(jsonStr);
}
