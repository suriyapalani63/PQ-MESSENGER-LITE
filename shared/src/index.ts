/**
 * PQ Messenger Shared Library
 * Post-Quantum Cryptography and Secure Messaging
 */

// Quantum Random Number Generation
export { QuantumRNG, qrng } from './qrng/QuantumRNG';

// Post-Quantum Cryptography
export {
  SecurityLevel,
  MLKEM,
  MLDSA,
  HybridEncryption,
  mlkem,
  mldsa,
  hybridEncryption,
  deriveKey
} from './crypto/PostQuantumCrypto';

// Secure Messaging
export {
  MessageType,
  SecureSession,
  MessageSerializer
} from './protocols/SecureMessaging';

// Secure WebRTC
export {
  WebRTCSecurityManager,
  secureWebRTCConfig,
  secureMediaConstraints
} from './protocols/SecureWebRTC';

// Type exports
export type { QRNGConfig, QRNGResponse } from './qrng/QuantumRNG';
export type { KeyPair, EncapsulatedSecret, Signature } from './crypto/PostQuantumCrypto';
export type {
  Message,
  TextMessage,
  FileMessage,
  KeyExchangeMessage
} from './protocols/SecureMessaging';
export type {
  RTCSessionDescription,
  RTCIceCandidate,
  SecureCallOffer,
  SecureCallAnswer,
  SecureICECandidate
} from './protocols/SecureWebRTC';
