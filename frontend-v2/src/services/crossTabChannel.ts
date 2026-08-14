/**
 * crossTabChannel.ts — BroadcastChannel wrapper for cross-tab communication.
 *
 * ⚠️  SAME-ORIGIN CROSS-TAB DEMO ONLY.
 *   • Uses BroadcastChannel API (primary) with `storage` event fallback.
 *   • Works only between tabs of the same browser on the same origin.
 *   • Real device-to-device communication requires Socket.IO / WebSocket.
 *
 * Events broadcast:
 *   PROFILE_CREATED, PEER_ADDED, MESSAGE_SENT, FILE_SHARED,
 *   MESSAGE_DELETED, PRESENCE_PING, PRESENCE_PONG
 */

import type { ChannelEvent, ChannelEventType } from '@/types/messaging';

const CHANNEL_NAME = 'pq_messenger_channel';
const STORAGE_SIGNAL_KEY = 'pq_channel_signal';

type EventHandler = (event: ChannelEvent) => void;

class CrossTabChannel {
  private bc: BroadcastChannel | null = null;
  private handlers: EventHandler[] = [];
  private useFallback = false;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(CHANNEL_NAME);
      this.bc.onmessage = (ev: MessageEvent) => {
        this.dispatch(ev.data as ChannelEvent);
      };
    } else {
      // Fallback: use localStorage `storage` event for cross-tab signaling.
      this.useFallback = true;
      window.addEventListener('storage', this.onStorageEvent);
    }
  }

  // ── Public API ───────────────────────────────────────────────────

  /** Subscribe to all cross-tab events. Returns an unsubscribe function. */
  subscribe(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /** Broadcast an event to all other tabs. */
  send(type: ChannelEventType, senderPeerId: string, payload: unknown): void {
    const event: ChannelEvent = {
      type,
      senderPeerId,
      timestamp: Date.now(),
      payload,
    };

    if (this.bc) {
      this.bc.postMessage(event);
    }

    if (this.useFallback) {
      // Write to localStorage to trigger `storage` event in other tabs.
      localStorage.setItem(STORAGE_SIGNAL_KEY, JSON.stringify(event));
      // Clean up immediately — the storage event already fired in other tabs.
      localStorage.removeItem(STORAGE_SIGNAL_KEY);
    }
  }

  /** Tear down listeners (call on unmount). */
  destroy(): void {
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
    if (this.useFallback) {
      window.removeEventListener('storage', this.onStorageEvent);
    }
    this.handlers = [];
  }

  // ── Internal ─────────────────────────────────────────────────────

  private onStorageEvent = (ev: StorageEvent) => {
    if (ev.key !== STORAGE_SIGNAL_KEY || !ev.newValue) return;
    try {
      const event = JSON.parse(ev.newValue) as ChannelEvent;
      this.dispatch(event);
    } catch {
      // Ignore malformed data.
    }
  };

  private dispatch(event: ChannelEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[CrossTabChannel] Handler error:', err);
      }
    }
  }
}

/** Singleton channel instance shared across the app. */
export const crossTabChannel = new CrossTabChannel();
