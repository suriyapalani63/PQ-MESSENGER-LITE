/**
 * PQ Messenger Lite — Type Definitions
 *
 * NOTE: This is a CROSS-TAB FRONTEND PROTOTYPE.
 * - Key fingerprints are mock/demo data generated from random hex.
 * - Actual ML-KEM encryption is NOT implemented in this UI-only phase.
 * - Cross-tab messaging works via BroadcastChannel (same origin only).
 * - Real device-to-device messaging requires Node.js / MongoDB / Socket.IO.
 */

// ─── User & Peer ───────────────────────────────────────────────────

/** Represents the current user's profile. Stored in sessionStorage (per-tab). */
export interface UserProfile {
  id: string;
  name: string;
  peerId: string;
  /** Real cryptographic fingerprint derived from public keys */
  fingerprint: string;
  createdAt: number;
}

/** Public profile info shared across tabs via localStorage `pq_profiles`. */
export interface PublicProfile {
  peerId: string;
  name: string;
  fingerprint: string;
  /** Base64 encoded ML-KEM-768 public key */
  kemPublicKeyBase64: string;
  /** Base64 encoded ML-DSA-65 public key */
  dsaPublicKeyBase64: string;
}

/**
 * Represents a remote peer the user has added.
 * `status` reflects cross-tab presence detection, NOT real network status.
 */
export interface Peer {
  id: string;
  name: string;
  peerId: string;
  /** Mock fingerprint — NOT a real cryptographic fingerprint. */
  fingerprint: string;
  /** 'online' = peer tab detected via BroadcastChannel heartbeat. */
  status: 'online' | 'offline';
  lastMessage?: string;
  timestamp?: number;
  unreadCount: number;
}

// ─── Messages & Attachments ────────────────────────────────────────

export interface FileAttachment {
  /** Reference to a blob stored in IndexedDB. */
  fileId: string;
  name: string;
  /** Human-readable size string, e.g. "2.4 MB". */
  size: string;
  /** MIME type, e.g. "application/pdf". */
  mimeType: string;
  /** Size in bytes. */
  byteSize: number;
  /** Base64 encoded file data for transferring to other peers. */
  dataBase64?: string;
}

export interface Message {
  id: string;
  /** The `UserProfile.id` of the sender. */
  senderId: string;
  /** The `peerId` of the sender (for cross-tab identification). */
  senderPeerId: string;
  text?: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'decrypt_failed' | 'delivery_failed';
  /** Always `true` in the UI — actual encryption is not yet implemented. */
  isEncrypted: boolean;
  file?: FileAttachment;
  /** Reason for decryption failure if status is 'decrypt_failed' */
  failureReason?: string;
}

// ─── Cross-Tab Channel Events ──────────────────────────────────────

export type ChannelEventType =
  | 'PROFILE_CREATED'
  | 'PEER_ADDED'
  | 'PUBLIC_KEYS_PUBLISHED'
  | 'SESSION_INIT'
  | 'SESSION_ACK'
  | 'MESSAGE_SENT'
  | 'FILE_SHARED'
  | 'MESSAGE_DELETED'
  | 'PRESENCE_PING'
  | 'PRESENCE_PONG';

export interface ChannelEvent {
  type: ChannelEventType;
  senderPeerId: string;
  timestamp: number;
  payload: unknown;
}

export interface MessageSentPayload {
  conversationId: string;
  message: Message;
}

export interface FileSharedPayload {
  conversationId: string;
  message: Message;
  /** The fileId pointing to IndexedDB blob data. */
  fileId: string;
}

export interface PresencePingPayload {
  peerId: string;
  name: string;
}

export interface PresencePongPayload {
  peerId: string;
  name: string;
}

export interface ProfileCreatedPayload {
  profile: PublicProfile;
}

export interface SessionInitPayload {
  conversationId: string;
  /** Encapsulated KEM ciphertext (Base64) */
  kemCiphertextBase64: string;
}

export interface SessionAckPayload {
  conversationId: string;
}

export interface PeerAddedPayload {
  /** The peerId of the peer that was added. */
  addedPeerId: string;
}
