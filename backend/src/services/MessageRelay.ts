/**
 * Message Relay Service
 * Handles message routing and delivery tracking
 */

export interface PendingMessage {
  messageId: string;
  sender: string;
  recipient: string;
  message: any;
  timestamp: number;
  retryCount: number;
}

export class MessageRelay {
  private pendingMessages: Map<string, PendingMessage[]> = new Map();
  private messageHistory: Map<string, Set<string>> = new Map();
  private readonly MAX_RETRY = 3;
  private readonly MESSAGE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Queue a message for offline user
   */
  queueMessage(message: any): void {
    const recipient = message.recipient;
    
    if (!this.pendingMessages.has(recipient)) {
      this.pendingMessages.set(recipient, []);
    }

    const pending: PendingMessage = {
      messageId: message.id,
      sender: message.sender,
      recipient,
      message,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.pendingMessages.get(recipient)!.push(pending);
  }

  /**
   * Get pending messages for a user
   */
  getPendingMessages(userId: string): any[] {
    const pending = this.pendingMessages.get(userId) || [];
    
    // Filter out expired messages
    const now = Date.now();
    const validMessages = pending.filter(
      msg => now - msg.timestamp < this.MESSAGE_TTL
    );

    return validMessages.map(msg => msg.message);
  }

  /**
   * Clear pending messages for a user
   */
  clearPendingMessages(userId: string, messageIds?: string[]): void {
    if (!messageIds) {
      this.pendingMessages.delete(userId);
      return;
    }

    const pending = this.pendingMessages.get(userId);
    
    if (pending) {
      const filtered = pending.filter(
        msg => !messageIds.includes(msg.messageId)
      );
      
      if (filtered.length > 0) {
        this.pendingMessages.set(userId, filtered);
      } else {
        this.pendingMessages.delete(userId);
      }
    }
  }

  /**
   * Track message delivery
   */
  markAsDelivered(messageId: string, userId: string): void {
    if (!this.messageHistory.has(userId)) {
      this.messageHistory.set(userId, new Set());
    }

    this.messageHistory.get(userId)!.add(messageId);
  }

  /**
   * Check if message was already delivered
   */
  wasDelivered(messageId: string, userId: string): boolean {
    return this.messageHistory.get(userId)?.has(messageId) || false;
  }

  /**
   * Increment retry count for a message
   */
  incrementRetry(messageId: string, userId: string): boolean {
    const pending = this.pendingMessages.get(userId);
    
    if (!pending) return false;

    const message = pending.find(msg => msg.messageId === messageId);
    
    if (message) {
      message.retryCount++;
      return message.retryCount < this.MAX_RETRY;
    }

    return false;
  }

  /**
   * Cleanup old messages and history
   */
  cleanup(): void {
    const now = Date.now();

    // Clean pending messages
    for (const [userId, messages] of this.pendingMessages) {
      const validMessages = messages.filter(
        msg => now - msg.timestamp < this.MESSAGE_TTL
      );

      if (validMessages.length > 0) {
        this.pendingMessages.set(userId, validMessages);
      } else {
        this.pendingMessages.delete(userId);
      }
    }

    // Clean message history (keep last 1000 per user)
    for (const [userId, history] of this.messageHistory) {
      if (history.size > 1000) {
        const historyArray = Array.from(history);
        const recent = new Set(historyArray.slice(-1000));
        this.messageHistory.set(userId, recent);
      }
    }
  }

  /**
   * Get stats
   */
  getStats(): {
    pendingMessageCount: number;
    usersWithPending: number;
    totalHistorySize: number;
  } {
    let totalPending = 0;
    
    for (const messages of this.pendingMessages.values()) {
      totalPending += messages.length;
    }

    let totalHistory = 0;
    
    for (const history of this.messageHistory.values()) {
      totalHistory += history.size;
    }

    return {
      pendingMessageCount: totalPending,
      usersWithPending: this.pendingMessages.size,
      totalHistorySize: totalHistory
    };
  }
}
