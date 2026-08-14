/**
 * Secure Messaging Protocol
 * End-to-end encrypted messaging with post-quantum security
 */

import { randomBytes, createHash } from 'crypto';
import { MLKEM, MLDSA, HybridEncryption, KeyPair } from '../crypto/PostQuantumCrypto';
import { qrng } from '../qrng/QuantumRNG';

export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  CALL_OFFER = 'call_offer',
  CALL_ANSWER = 'call_answer',
  CALL_ICE = 'call_ice',
  KEY_EXCHANGE = 'key_exchange',
  RECEIPT = 'receipt'
}

export interface Message {
  id: string;
  type: MessageType;
  sender: string;
  recipient: string;
  timestamp: number;
  encryptedContent: Buffer;
  encapsulatedKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
  signature?: Buffer;
}

export interface TextMessage {
  type: MessageType.TEXT;
  content: string;
  replyTo?: string;
}

export interface FileMessage {
  type: MessageType.FILE;
  fileName: string;
  fileSize: number;
  mimeType: string;
  encryptedData: Buffer;
}

export interface KeyExchangeMessage {
  type: MessageType.KEY_EXCHANGE;
  kemPublicKey: Buffer;
  dsaPublicKey: Buffer;
  userId: string;
}

/**
 * Secure Session Manager
 * Manages encryption sessions between users
 */
export class SecureSession {
  private userId: string;
  private kemKeyPair?: KeyPair;
  private dsaKeyPair?: KeyPair;
  private peerKEMPublicKeys: Map<string, Buffer> = new Map();
  private peerDSAPublicKeys: Map<string, Buffer> = new Map();
  private hybridEncryption: HybridEncryption;
  private kem: MLKEM;
  private dsa: MLDSA;

  constructor(userId: string) {
    this.userId = userId;
    this.hybridEncryption = new HybridEncryption();
    this.kem = new MLKEM();
    this.dsa = new MLDSA();
  }

  /**
   * Initialize session with key generation
   */
  async initialize(): Promise<void> {
    // Generate post-quantum keypairs
    this.kemKeyPair = await this.kem.generateKeyPair();
    this.dsaKeyPair = await this.dsa.generateKeyPair();
    
    console.log(`Session initialized for user ${this.userId}`);
  }

  /**
   * Get public keys for key exchange
   */
  getPublicKeys(): KeyExchangeMessage {
    if (!this.kemKeyPair || !this.dsaKeyPair) {
      throw new Error('Session not initialized');
    }

    return {
      type: MessageType.KEY_EXCHANGE,
      kemPublicKey: this.kemKeyPair.publicKey,
      dsaPublicKey: this.dsaKeyPair.publicKey,
      userId: this.userId
    };
  }

  /**
   * Register peer's public keys
   */
  registerPeerKeys(peerId: string, kemPublicKey: Buffer, dsaPublicKey: Buffer): void {
    this.peerKEMPublicKeys.set(peerId, kemPublicKey);
    this.peerDSAPublicKeys.set(peerId, dsaPublicKey);
    
    console.log(`Registered keys for peer ${peerId}`);
  }

  /**
   * Encrypt and send a message
   */
  async encryptMessage(
    recipientId: string,
    messageContent: TextMessage | FileMessage
  ): Promise<Message> {
    const recipientKEMKey = this.peerKEMPublicKeys.get(recipientId);
    if (!recipientKEMKey) {
      throw new Error(`No public key found for recipient ${recipientId}`);
    }

    // Serialize message content
    const contentBuffer = Buffer.from(JSON.stringify(messageContent), 'utf8');

    // Encrypt with hybrid encryption
    const {
      ciphertext,
      encapsulatedKey,
      iv,
      authTag
    } = await this.hybridEncryption.encrypt(contentBuffer, recipientKEMKey);

    // Sign the message
    let signature: Buffer | undefined;
    if (this.dsaKeyPair) {
      const messageToSign = Buffer.concat([ciphertext, encapsulatedKey, iv, authTag]);
      const signatureResult = await this.dsa.sign(messageToSign, this.dsaKeyPair.privateKey);
      signature = signatureResult.signature;
    }

    // Generate quantum random message ID
    const messageId = await qrng.generateUUID();

    return {
      id: messageId,
      type: messageContent.type,
      sender: this.userId,
      recipient: recipientId,
      timestamp: Date.now(),
      encryptedContent: ciphertext,
      encapsulatedKey,
      iv,
      authTag,
      signature
    };
  }

  /**
   * Decrypt and verify a received message
   */
  async decryptMessage(message: Message): Promise<TextMessage | FileMessage> {
    if (!this.kemKeyPair) {
      throw new Error('Session not initialized');
    }

    // Verify signature if present
    if (message.signature) {
      const senderDSAKey = this.peerDSAPublicKeys.get(message.sender);
      if (senderDSAKey) {
        const messageToVerify = Buffer.concat([
          message.encryptedContent,
          message.encapsulatedKey,
          message.iv,
          message.authTag
        ]);
        
        const isValid = await this.dsa.verify(
          messageToVerify,
          message.signature,
          senderDSAKey
        );

        if (!isValid) {
          throw new Error('Message signature verification failed');
        }
      }
    }

    // Decrypt message
    const decryptedContent = await this.hybridEncryption.decrypt(
      message.encryptedContent,
      message.encapsulatedKey,
      message.iv,
      message.authTag,
      this.kemKeyPair.privateKey
    );

    // Parse content
    const contentString = decryptedContent.toString('utf8');
    return JSON.parse(contentString);
  }

  /**
   * Generate perfect forward secrecy session key
   */
  async rotateSessionKeys(): Promise<void> {
    // Generate new keypairs for forward secrecy
    this.kemKeyPair = await this.kem.generateKeyPair();
    console.log('Session keys rotated for forward secrecy');
  }

  /**
   * Export session keys for backup (encrypted)
   */
  async exportKeys(password: string): Promise<Buffer> {
    if (!this.kemKeyPair || !this.dsaKeyPair) {
      throw new Error('Session not initialized');
    }

    const crypto = require('crypto');
    
    // Derive key from password
    const salt = await qrng.getRandomBytes(32);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = await qrng.generateNonce(16);

    // Serialize keys
    const keysData = JSON.stringify({
      kemPublicKey: this.kemKeyPair.publicKey.toString('base64'),
      kemPrivateKey: this.kemKeyPair.privateKey.toString('base64'),
      dsaPublicKey: this.dsaKeyPair.publicKey.toString('base64'),
      dsaPrivateKey: this.dsaKeyPair.privateKey.toString('base64'),
      userId: this.userId
    });

    // Encrypt with AES
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(keysData, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    // Combine salt, iv, authTag, and encrypted data
    return Buffer.concat([
      salt,
      iv,
      authTag,
      encrypted
    ]);
  }

  /**
   * Import session keys from backup
   */
  async importKeys(encryptedKeys: Buffer, password: string): Promise<void> {
    const crypto = require('crypto');

    // Extract components
    const salt = encryptedKeys.slice(0, 32);
    const iv = encryptedKeys.slice(32, 48);
    const authTag = encryptedKeys.slice(48, 64);
    const encrypted = encryptedKeys.slice(64);

    // Derive key from password
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    // Parse keys
    const keysData = JSON.parse(decrypted.toString('utf8'));
    
    this.kemKeyPair = {
      publicKey: Buffer.from(keysData.kemPublicKey, 'base64'),
      privateKey: Buffer.from(keysData.kemPrivateKey, 'base64'),
      algorithm: 'ML-KEM-256'
    };

    this.dsaKeyPair = {
      publicKey: Buffer.from(keysData.dsaPublicKey, 'base64'),
      privateKey: Buffer.from(keysData.dsaPrivateKey, 'base64'),
      algorithm: 'ML-DSA-256'
    };

    console.log('Session keys imported successfully');
  }

  /**
   * Clear sensitive data from memory
   */
  destroy(): void {
    // Overwrite sensitive data
    if (this.kemKeyPair) {
      this.kemKeyPair.privateKey.fill(0);
      this.kemKeyPair.publicKey.fill(0);
    }
    
    if (this.dsaKeyPair) {
      this.dsaKeyPair.privateKey.fill(0);
      this.dsaKeyPair.publicKey.fill(0);
    }

    this.peerKEMPublicKeys.clear();
    this.peerDSAPublicKeys.clear();
    
    console.log('Session destroyed and keys cleared from memory');
  }
}

/**
 * Message serialization utilities
 */
export class MessageSerializer {
  /**
   * Serialize message for transmission
   */
  static serialize(message: Message): string {
    return JSON.stringify({
      ...message,
      encryptedContent: message.encryptedContent.toString('base64'),
      encapsulatedKey: message.encapsulatedKey.toString('base64'),
      iv: message.iv.toString('base64'),
      authTag: message.authTag.toString('base64'),
      signature: message.signature?.toString('base64')
    });
  }

  /**
   * Deserialize message from transmission
   */
  static deserialize(serialized: string): Message {
    const parsed = JSON.parse(serialized);
    
    return {
      ...parsed,
      encryptedContent: Buffer.from(parsed.encryptedContent, 'base64'),
      encapsulatedKey: Buffer.from(parsed.encapsulatedKey, 'base64'),
      iv: Buffer.from(parsed.iv, 'base64'),
      authTag: Buffer.from(parsed.authTag, 'base64'),
      signature: parsed.signature ? Buffer.from(parsed.signature, 'base64') : undefined
    };
  }
}
