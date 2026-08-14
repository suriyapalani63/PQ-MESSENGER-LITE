import { crossTabChannel } from './crossTabChannel';
import { socketClient } from './socketClient';
import type { ChannelEvent, ChannelEventType, PublicProfile } from '@/types/messaging';

const USE_SOCKETS = import.meta.env.VITE_USE_SOCKETS === 'true';

type EventHandler = (event: ChannelEvent) => void;
type ConnectionHandler = (status: 'disconnected' | 'connecting' | 'connected' | 'registered' | 'error') => void;

class TransportManager {
  private handlers: EventHandler[] = [];
  
  constructor() {
    if (USE_SOCKETS) {
      socketClient.subscribe((event) => this.dispatch(event));
    } else {
      crossTabChannel.subscribe((event) => this.dispatch(event));
    }
  }

  connect(userId: string, publicKeys: Omit<PublicProfile, 'peerId' | 'name' | 'fingerprint'>) {
    if (USE_SOCKETS) {
      socketClient.connect(userId, publicKeys);
    }
  }

  disconnect() {
    if (USE_SOCKETS) {
      socketClient.disconnect();
    } else {
      crossTabChannel.destroy();
    }
  }

  onConnectionChange(handler: ConnectionHandler) {
    if (USE_SOCKETS) {
      return socketClient.onConnectionChange(handler);
    }
    return () => {};
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  private dispatch(event: ChannelEvent) {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  send(messageId: string, type: ChannelEventType, senderPeerId: string, recipientPeerId: string, conversationId: string, payload: any) {
    if (USE_SOCKETS) {
      socketClient.send(messageId, type, recipientPeerId, conversationId, payload);
    } else {
      crossTabChannel.send(type, senderPeerId, {
        messageId,
        conversationId,
        ...payload
      });
    }
  }
}

export const transport = new TransportManager();
