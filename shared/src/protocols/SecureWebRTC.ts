/**
 * Secure WebRTC Protocol
 * Post-quantum secure voice and video calling
 */

import { qrng } from '../qrng/QuantumRNG';
import { MLKEM, MLDSA } from '../crypto/PostQuantumCrypto';
import { createHash } from 'crypto';

export interface RTCSessionDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface RTCIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface SecureCallOffer {
  sessionId: string;
  callerId: string;
  recipientId: string;
  sdp: RTCSessionDescription;
  kemPublicKey: Buffer;
  timestamp: number;
  signature: Buffer;
}

export interface SecureCallAnswer {
  sessionId: string;
  answerer: string;
  sdp: RTCSessionDescription;
  encapsulatedKey: Buffer;
  timestamp: number;
  signature: Buffer;
}

export interface SecureICECandidate {
  sessionId: string;
  candidate: RTCIceCandidate;
  signature: Buffer;
}

/**
 * WebRTC Security Manager
 * Handles post-quantum key exchange for WebRTC sessions
 */
export class WebRTCSecurityManager {
  private kem: MLKEM;
  private dsa: MLDSA;
  private sessions: Map<string, SessionState> = new Map();

  constructor() {
    this.kem = new MLKEM();
    this.dsa = new MLDSA();
  }

  /**
   * Create a secure call offer
   */
  async createCallOffer(
    callerId: string,
    recipientId: string,
    sdp: RTCSessionDescription,
    signingKey: Buffer
  ): Promise<SecureCallOffer> {
    // Generate session ID using quantum randomness
    const sessionId = await qrng.generateUUID();

    // Generate ephemeral KEM keypair for this session
    const kemKeyPair = await this.kem.generateKeyPair();

    // Store session state
    this.sessions.set(sessionId, {
      sessionId,
      role: 'caller',
      kemKeyPair,
      peerId: recipientId,
      createdAt: Date.now()
    });

    // Sign the offer
    const offerData = Buffer.from(JSON.stringify({
      sessionId,
      callerId,
      recipientId,
      sdp,
      kemPublicKey: kemKeyPair.publicKey.toString('base64'),
      timestamp: Date.now()
    }), 'utf8');

    const signatureResult = await this.dsa.sign(offerData, signingKey);

    return {
      sessionId,
      callerId,
      recipientId,
      sdp,
      kemPublicKey: kemKeyPair.publicKey,
      timestamp: Date.now(),
      signature: signatureResult.signature
    };
  }

  /**
   * Verify and process call offer
   */
  async processCallOffer(
    offer: SecureCallOffer,
    callerDSAPublicKey: Buffer
  ): Promise<boolean> {
    // Verify signature
    const offerData = Buffer.from(JSON.stringify({
      sessionId: offer.sessionId,
      callerId: offer.callerId,
      recipientId: offer.recipientId,
      sdp: offer.sdp,
      kemPublicKey: offer.kemPublicKey.toString('base64'),
      timestamp: offer.timestamp
    }), 'utf8');

    const isValid = await this.dsa.verify(
      offerData,
      offer.signature,
      callerDSAPublicKey
    );

    if (!isValid) {
      console.error('Call offer signature verification failed');
      return false;
    }

    // Store peer's KEM public key
    this.sessions.set(offer.sessionId, {
      sessionId: offer.sessionId,
      role: 'answerer',
      peerKEMPublicKey: offer.kemPublicKey,
      peerId: offer.callerId,
      createdAt: Date.now()
    });

    return true;
  }

  /**
   * Create secure call answer with key encapsulation
   */
  async createCallAnswer(
    sessionId: string,
    answererId: string,
    sdp: RTCSessionDescription,
    signingKey: Buffer
  ): Promise<SecureCallAnswer> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.peerKEMPublicKey) {
      throw new Error('Invalid session or missing peer public key');
    }

    // Encapsulate shared secret using caller's public key
    const { ciphertext: encapsulatedKey, sharedSecret } = 
      await this.kem.encapsulate(session.peerKEMPublicKey);

    // Derive SRTP master key from shared secret
    const srtpMasterKey = createHash('sha256')
      .update(Buffer.concat([sharedSecret, Buffer.from('SRTP', 'utf8')]))
      .digest();

    // Store the shared secret for this session
    session.sharedSecret = sharedSecret;
    session.srtpMasterKey = srtpMasterKey;

    // Sign the answer
    const answerData = Buffer.from(JSON.stringify({
      sessionId,
      answererId,
      sdp,
      encapsulatedKey: encapsulatedKey.toString('base64'),
      timestamp: Date.now()
    }), 'utf8');

    const signatureResult = await this.dsa.sign(answerData, signingKey);

    return {
      sessionId,
      answerer: answererId,
      sdp,
      encapsulatedKey,
      timestamp: Date.now(),
      signature: signatureResult.signature
    };
  }

  /**
   * Process call answer and derive shared secret
   */
  async processCallAnswer(
    answer: SecureCallAnswer,
    answererDSAPublicKey: Buffer
  ): Promise<{ srtpMasterKey: Buffer } | null> {
    // Verify signature
    const answerData = Buffer.from(JSON.stringify({
      sessionId: answer.sessionId,
      answererId: answer.answerer,
      sdp: answer.sdp,
      encapsulatedKey: answer.encapsulatedKey.toString('base64'),
      timestamp: answer.timestamp
    }), 'utf8');

    const isValid = await this.dsa.verify(
      answerData,
      answer.signature,
      answererDSAPublicKey
    );

    if (!isValid) {
      console.error('Call answer signature verification failed');
      return null;
    }

    // Get session state
    const session = this.sessions.get(answer.sessionId);
    if (!session || !session.kemKeyPair) {
      throw new Error('Invalid session or missing keypair');
    }

    // Decapsulate to get shared secret
    const sharedSecret = await this.kem.decapsulate(
      answer.encapsulatedKey,
      session.kemKeyPair.privateKey
    );

    // Derive SRTP master key
    const srtpMasterKey = createHash('sha256')
      .update(Buffer.concat([sharedSecret, Buffer.from('SRTP', 'utf8')]))
      .digest();

    // Update session
    session.sharedSecret = sharedSecret;
    session.srtpMasterKey = srtpMasterKey;

    return { srtpMasterKey };
  }

  /**
   * Sign ICE candidate
   */
  async signICECandidate(
    sessionId: string,
    candidate: RTCIceCandidate,
    signingKey: Buffer
  ): Promise<SecureICECandidate> {
    const candidateData = Buffer.from(JSON.stringify({
      sessionId,
      candidate
    }), 'utf8');

    const signatureResult = await this.dsa.sign(candidateData, signingKey);

    return {
      sessionId,
      candidate,
      signature: signatureResult.signature
    };
  }

  /**
   * Verify ICE candidate
   */
  async verifyICECandidate(
    secureCandidate: SecureICECandidate,
    peerDSAPublicKey: Buffer
  ): Promise<boolean> {
    const candidateData = Buffer.from(JSON.stringify({
      sessionId: secureCandidate.sessionId,
      candidate: secureCandidate.candidate
    }), 'utf8');

    return await this.dsa.verify(
      candidateData,
      secureCandidate.signature,
      peerDSAPublicKey
    );
  }

  /**
   * Get session SRTP key
   */
  getSessionKey(sessionId: string): Buffer | null {
    const session = this.sessions.get(sessionId);
    return session?.srtpMasterKey || null;
  }

  /**
   * End session and cleanup
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      // Clear sensitive data
      if (session.sharedSecret) {
        session.sharedSecret.fill(0);
      }
      if (session.srtpMasterKey) {
        session.srtpMasterKey.fill(0);
      }
      if (session.kemKeyPair) {
        session.kemKeyPair.privateKey.fill(0);
      }
      
      this.sessions.delete(sessionId);
      console.log(`Session ${sessionId} ended and cleaned up`);
    }
  }

  /**
   * Cleanup old sessions (older than 1 hour)
   */
  cleanupOldSessions(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [sessionId, session] of this.sessions) {
      if (now - session.createdAt > maxAge) {
        this.endSession(sessionId);
      }
    }
  }
}

interface SessionState {
  sessionId: string;
  role: 'caller' | 'answerer';
  kemKeyPair?: {
    publicKey: Buffer;
    privateKey: Buffer;
    algorithm: string;
  };
  peerKEMPublicKey?: Buffer;
  sharedSecret?: Buffer;
  srtpMasterKey?: Buffer;
  peerId: string;
  createdAt: number;
}

/**
 * Configuration for secure WebRTC
 */
export const secureWebRTCConfig = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302'
    },
    {
      urls: 'stun:stun1.l.google.com:19302'
    }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle' as RTCBundlePolicy,
  rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
  // Require DTLS-SRTP encryption
  sdpSemantics: 'unified-plan' as any
};

/**
 * Media constraints for high-quality secure calls
 */
export const secureMediaConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: 'user'
  }
};
