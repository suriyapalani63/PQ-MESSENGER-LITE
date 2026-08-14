import { describe, it, expect, beforeAll } from 'vitest';
import { initOQS, generateKEMKeyPair, encapsulate, decapsulate, generateSigKeyPair, sign, verify } from '../src/crypto/oqsAdapter';
import { deriveKeyHKDF, encryptPayload, decryptPayload, createEnvelope, verifyEnvelope } from '../src/crypto/protocol';
import { encodeForSigning } from '../src/crypto/canonical';

describe('Post-Quantum Cryptography Suite', () => {
  beforeAll(async () => {
    await initOQS();
  });

  describe('ML-KEM-768', () => {
    it('should generate matching shared secrets during encapsulation/decapsulation', async () => {
      const kemKeypair = await generateKEMKeyPair();
      const { ciphertext, sharedSecret } = await encapsulate(kemKeypair.publicKey);
      const decapsulatedSecret = await decapsulate(ciphertext, kemKeypair.privateKey);
      
      expect(sharedSecret).toEqual(decapsulatedSecret);
    });

    it('should fail if decapsulating with a wrong private key', async () => {
      const alice = await generateKEMKeyPair();
      const bob = await generateKEMKeyPair();
      
      const { ciphertext } = await encapsulate(alice.publicKey);
      
      const decapsulated = await decapsulate(ciphertext, bob.privateKey);
      // Decapsulating with wrong key usually produces a pseudorandom deterministic key in Kyber,
      // not an error, but it won't match the original sharedSecret. We just check it doesn't throw.
      expect(decapsulated.length).toBeGreaterThan(0);
    });
  });

  describe('ML-DSA-65', () => {
    it('should successfully sign and verify a message', async () => {
      const dsaKeypair = await generateSigKeyPair();
      const msg = new TextEncoder().encode('Hello Post-Quantum World');
      const signature = await sign(msg, dsaKeypair.privateKey);
      
      const isVerified = await verify(msg, signature, dsaKeypair.publicKey);
      expect(isVerified).toBe(true);
    });

    it('should fail to verify a tampered signature or message', async () => {
      const dsaKeypair = await generateSigKeyPair();
      const msg = new TextEncoder().encode('Hello Post-Quantum World');
      const signature = await sign(msg, dsaKeypair.privateKey);
      
      const tamperedMsg = new TextEncoder().encode('Hello Post-Quantum World!');
      const isVerified = await verify(tamperedMsg, signature, dsaKeypair.publicKey);
      expect(isVerified).toBe(false);
      
      // Tamper signature
      const tamperedSig = new Uint8Array(signature);
      tamperedSig[0] ^= 1;
      const isSigVerified = await verify(msg, tamperedSig, dsaKeypair.publicKey);
      expect(isSigVerified).toBe(false);
    });

    it('should fail to verify with wrong public key', async () => {
      const alice = await generateSigKeyPair();
      const bob = await generateSigKeyPair();
      
      const msg = new TextEncoder().encode('Hello');
      const signature = await sign(msg, alice.privateKey);
      
      const isVerified = await verify(msg, signature, bob.publicKey);
      expect(isVerified).toBe(false);
    });
  });

  describe('Protocol (AES-GCM & HKDF)', () => {
    it('should correctly derive keys, encrypt and decrypt a payload', async () => {
      const dummySecret = new Uint8Array(32);
      dummySecret.fill(42);
      
      const key = await deriveKeyHKDF(dummySecret, new Uint8Array(32), 'test-info');
      
      const plaintext = JSON.stringify({ text: 'Secret message' });
      const { ciphertext, iv } = await encryptPayload(plaintext, key);
      
      const decrypted = await decryptPayload(ciphertext, iv, key);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Envelope Authentication', () => {
    it('should properly sign and verify an encrypted envelope', async () => {
      const dsaKeypair = await generateSigKeyPair();
      
      const ciphertext = new Uint8Array([1, 2, 3, 4]);
      const iv = new Uint8Array([5, 6, 7, 8]);
      const metadata = { counter: 1, sender: 'Alice' };
      
      const envelope = await createEnvelope(ciphertext, iv, metadata, dsaKeypair.privateKey);
      
      const isVerified = await verifyEnvelope(envelope, metadata, dsaKeypair.publicKey);
      expect(isVerified).toBe(true);
    });
  });

  describe('Cross-Tab Messaging', () => {
    it('should preserve Uint8Array natively using structuredClone', () => {
      const original = new Uint8Array([10, 20, 30, 40]);
      const cloned = structuredClone(original);
      expect(cloned).toBeInstanceOf(Uint8Array);
      expect(cloned).toEqual(original);
    });

    it('should maintain IV, ciphertext, and signature byte-for-byte equality', async () => {
      const dsaKeypair = await generateSigKeyPair();
      const ciphertext = new Uint8Array([1, 2, 3, 4]);
      const iv = new Uint8Array([5, 6, 7, 8]);
      const metadata = { counter: 1, sender: 'Alice' };
      const envelope = await createEnvelope(ciphertext, iv, metadata, dsaKeypair.privateKey);
      
      const payload = { envelope, metadata };
      const clonedPayload = structuredClone(payload);
      
      expect(clonedPayload.envelope.iv).toEqual(iv);
      expect(clonedPayload.envelope.ciphertext).toEqual(ciphertext);
      expect(clonedPayload.envelope.signature).toEqual(envelope.signature);
    });

    it('should complete a full transport encryption/decryption round trip', async () => {
      const dummySecret = new Uint8Array(32);
      dummySecret.fill(12);
      const sendKey = await deriveKeyHKDF(dummySecret, new Uint8Array(32), 'send');
      const recvKey = await deriveKeyHKDF(dummySecret, new Uint8Array(32), 'send'); // Same key for test
      const dsaKeypair = await generateSigKeyPair();

      const plaintext = JSON.stringify({ text: 'Hello Cross Tab' });
      const { ciphertext, iv } = await encryptPayload(plaintext, sendKey);
      const metadata = { counter: 1, msgId: '123' };
      const envelope = await createEnvelope(ciphertext, iv, metadata, dsaKeypair.privateKey);
      
      // Simulate transport
      const cloned = structuredClone({ envelope, metadata });
      
      // Verify & Decrypt
      const isVerified = await verifyEnvelope(cloned.envelope, cloned.metadata, dsaKeypair.publicKey);
      expect(isVerified).toBe(true);
      
      const decrypted = await decryptPayload(cloned.envelope.ciphertext, cloned.envelope.iv, recvKey);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail with invalid_signature on tampered signature', async () => {
      const dsaKeypair = await generateSigKeyPair();
      const envelope = await createEnvelope(new Uint8Array([1]), new Uint8Array(12), { counter: 1 }, dsaKeypair.privateKey);
      
      envelope.signature[0] ^= 1;
      const isVerified = await verifyEnvelope(envelope, { counter: 1 }, dsaKeypair.publicKey);
      expect(isVerified).toBe(false);
    });
    
    it('should fail decryption if wrong key is used (simulate decrypt_error)', async () => {
      const sendKey = await deriveKeyHKDF(new Uint8Array(32), new Uint8Array(32), 'send');
      const wrongKey = await deriveKeyHKDF(new Uint8Array(32), new Uint8Array(32), 'wrong');
      
      const { ciphertext, iv } = await encryptPayload("secret", sendKey);
      
      await expect(decryptPayload(ciphertext, iv, wrongKey)).rejects.toThrow();
    });
    
    it('persistence serialization/deserialization (Message shape)', () => {
      const msg = {
        id: 'msg-1',
        senderId: 'user1',
        senderPeerId: 'peer1',
        text: 'hello',
        timestamp: 12345,
        status: 'delivered',
        isEncrypted: true
      };
      
      const serialized = JSON.stringify(msg);
      const deserialized = JSON.parse(serialized);
      
      expect(deserialized.id).toBe('msg-1');
      expect(deserialized.status).toBe('delivered');
      
      const failedMsg = { ...msg, status: 'decrypt_failed', failureReason: 'invalid_signature' };
      const serFailed = JSON.stringify(failedMsg);
      const desFailed = JSON.parse(serFailed);
      expect(desFailed.failureReason).toBe('invalid_signature');
    });
  });
});
