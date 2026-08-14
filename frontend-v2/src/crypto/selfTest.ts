/**
 * selfTest.ts — Startup verification for the cryptography module
 * 
 * Ensures KEM, DSA, and AES functions are working correctly.
 */

import { initOQS, generateKEMKeyPair, encapsulate, decapsulate, generateSigKeyPair, sign, verify } from './oqsAdapter';
import { deriveKeyHKDF, encryptPayload, decryptPayload } from './protocol';

export async function runCryptoSelfTest(): Promise<boolean> {
  try {
    await initOQS();

    // 1. KEM Test
    const kemKeypair = await generateKEMKeyPair();
    const { ciphertext, sharedSecret } = await encapsulate(kemKeypair.publicKey);
    const decapsulatedSecret = await decapsulate(ciphertext, kemKeypair.privateKey);

    if (sharedSecret.toString() !== decapsulatedSecret.toString()) {
      throw new Error('KEM shared secrets do not match');
    }

    // 2. DSA Test
    const dsaKeypair = await generateSigKeyPair();
    const message = new TextEncoder().encode('Test Message');
    const signature = await sign(message, dsaKeypair.privateKey);
    const isVerified = await verify(message, signature, dsaKeypair.publicKey);
    
    if (!isVerified) {
      throw new Error('Valid signature failed to verify');
    }

    // Tamper test
    const tamperedMessage = new TextEncoder().encode('Test Messagf');
    const isTamperedVerified = await verify(tamperedMessage, signature, dsaKeypair.publicKey);
    if (isTamperedVerified) {
      throw new Error('Tampered signature incorrectly verified');
    }

    // 3. AES-GCM Test
    const derivedKey = await deriveKeyHKDF(sharedSecret);
    const plaintext = "Hello World";
    const { ciphertext: aesCt, iv } = await encryptPayload(plaintext, derivedKey);
    const decrypted = await decryptPayload(aesCt, iv, derivedKey);

    if (plaintext !== decrypted) {
      throw new Error('AES-GCM decryption mismatch');
    }

    return true;
  } catch (err) {
    console.error('Crypto self-test failed:', err);
    return false;
  }
}
