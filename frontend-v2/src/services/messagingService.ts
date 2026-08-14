/**
 * PQ Messenger Lite — Messaging Service (Storage Layer)
 *
 * ⚠️  CROSS-TAB DEMO — NOT A REAL NETWORK SERVICE.
 *
 * Architecture:
 *   • currentUser is stored in **sessionStorage** (per-tab identity).
 *   • Public profiles are stored in **localStorage** `pq_profiles` (shared).
 *   • Peer lists are per-user in localStorage `pq_peers_<ownerPeerId>`.
 *   • Conversations use a stable shared key:
 *       `pq_conversation_<sorted_peerIdA>__<sorted_peerIdB>`
 *   • File blobs live in IndexedDB (see fileStore.ts).
 *
 * Cross-tab messaging works ONLY within the same browser origin.
 * Real device-to-device messaging requires Node.js / MongoDB / Socket.IO.
 */

import type { UserProfile, PublicProfile, Peer, Message } from '@/types/messaging';

// ─── Key helpers ───────────────────────────────────────────────────

const SESSION_KEY_USER = 'pq_session_user';
const LS_KEY_PROFILES = 'pq_profiles';

const KEYS = {
  peers: (ownerPeerId: string) => `pq_peers_${ownerPeerId}`,
  conversation: (convId: string) => `pq_conversation_${convId}`,
} as const;

// ─── Conversation ID ───────────────────────────────────────────────

/** Build a stable, sorted conversation ID from two Peer IDs. */
export function buildConversationId(peerIdA: string, peerIdB: string): string {
  return [peerIdA, peerIdB].sort().join('__');
}

// ─── ID / fingerprint generators ───────────────────────────────────

function hexSegment(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/** Generate a Peer ID like `PQ-A1C4-8F20`. */
export function generatePeerId(): string {
  return `PQ-${hexSegment(4)}-${hexSegment(4)}`;
}

/**
 * Generate a mock key fingerprint like `92F7:0A31:8D44:BC20`.
 * ⚠️  NOT a real cryptographic fingerprint.
 */
export function generateFingerprint(): string {
  return `${hexSegment(4)}:${hexSegment(4)}:${hexSegment(4)}:${hexSegment(4)}`;
}

// ─── Session-scoped user (sessionStorage — per tab) ────────────────

export function loadCurrentUser(): UserProfile | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY_USER);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: UserProfile): void {
  sessionStorage.setItem(SESSION_KEY_USER, JSON.stringify(user));
}

export function clearCurrentUser(): void {
  sessionStorage.removeItem(SESSION_KEY_USER);
}

// ─── Shared profile registry (localStorage — cross-tab) ───────────

export function loadProfiles(): PublicProfile[] {
  try {
    const raw = localStorage.getItem(LS_KEY_PROFILES);
    if (!raw) return [];
    return JSON.parse(raw) as PublicProfile[];
  } catch {
    return [];
  }
}

function saveProfiles(profiles: PublicProfile[]): void {
  localStorage.setItem(LS_KEY_PROFILES, JSON.stringify(profiles));
}

/** Register a public profile. Overwrites if same peerId exists. */
export function registerProfile(profile: PublicProfile): void {
  const profiles = loadProfiles().filter((p) => p.peerId !== profile.peerId);
  profiles.push(profile);
  saveProfiles(profiles);
}

/** Look up a public profile by Peer ID. */
export function lookupProfile(peerId: string): PublicProfile | null {
  return loadProfiles().find((p) => p.peerId === peerId) ?? null;
}

export function unregisterProfile(peerId: string): void {
  saveProfiles(loadProfiles().filter((p) => p.peerId !== peerId));
}

// ─── Peer list persistence (per-user, localStorage) ────────────────

export function loadPeers(ownerPeerId: string): Peer[] {
  try {
    const raw = localStorage.getItem(KEYS.peers(ownerPeerId));
    if (!raw) return [];
    return JSON.parse(raw) as Peer[];
  } catch {
    return [];
  }
}

export function savePeers(ownerPeerId: string, peers: Peer[]): void {
  localStorage.setItem(KEYS.peers(ownerPeerId), JSON.stringify(peers));
}

// ─── Shared conversation persistence (localStorage) ────────────────

export function loadMessages(conversationId: string): Message[] {
  try {
    const raw = localStorage.getItem(KEYS.conversation(conversationId));
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

export function saveMessages(conversationId: string, msgs: Message[]): void {
  localStorage.setItem(KEYS.conversation(conversationId), JSON.stringify(msgs));
}

// ─── Peer-ID format validation ─────────────────────────────────────

export function isValidPeerId(peerId: string): boolean {
  return /^PQ-[0-9A-F]{4}-[0-9A-F]{4}$/.test(peerId);
}

// ─── Human-readable file size ──────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
