/**
 * Call Signaling Service
 * Manages WebRTC call setup and signaling
 */

import { UserManager } from './UserManager';

export interface CallSession {
  sessionId: string;
  callerId: string;
  recipientId: string;
  callerSocketId: string;
  recipientSocketId?: string;
  status: 'ringing' | 'active' | 'ended';
  startTime: number;
  endTime?: number;
}

export class CallSignaling {
  private activeCalls: Map<string, CallSession> = new Map();
  private userManager: UserManager;

  constructor(userManager: UserManager) {
    this.userManager = userManager;
  }

  /**
   * Handle incoming call offer
   */
  async handleCallOffer(
    offer: any,
    callerSocketId: string
  ): Promise<{ success: boolean; recipientSocketId?: string; reason?: string }> {
    const { sessionId, callerId, recipientId } = offer;

    // Check if recipient is online
    const recipientSocketId = this.userManager.getSocketId(recipientId);
    
    if (!recipientSocketId) {
      return {
        success: false,
        reason: 'recipient-offline'
      };
    }

    // Check if either user is already in a call
    if (this.isUserInCall(callerId) || this.isUserInCall(recipientId)) {
      return {
        success: false,
        reason: 'user-busy'
      };
    }

    // Create call session
    const session: CallSession = {
      sessionId,
      callerId,
      recipientId,
      callerSocketId,
      recipientSocketId,
      status: 'ringing',
      startTime: Date.now()
    };

    this.activeCalls.set(sessionId, session);

    return {
      success: true,
      recipientSocketId
    };
  }

  /**
   * Handle call answer
   */
  handleCallAnswer(sessionId: string): void {
    const session = this.activeCalls.get(sessionId);
    
    if (session) {
      session.status = 'active';
    }
  }

  /**
   * End a call
   */
  endCall(sessionId: string): void {
    const session = this.activeCalls.get(sessionId);
    
    if (session) {
      session.status = 'ended';
      session.endTime = Date.now();
      
      // Remove from active calls after a delay
      setTimeout(() => {
        this.activeCalls.delete(sessionId);
      }, 5000);
    }
  }

  /**
   * Get caller socket for a session
   */
  getCallerSocket(sessionId: string): string | undefined {
    return this.activeCalls.get(sessionId)?.callerSocketId;
  }

  /**
   * Get recipient socket for a session
   */
  getRecipientSocket(sessionId: string): string | undefined {
    return this.activeCalls.get(sessionId)?.recipientSocketId;
  }

  /**
   * Get peer socket ID (opposite of current user)
   */
  getPeerSocket(sessionId: string, currentSocketId: string): string | undefined {
    const session = this.activeCalls.get(sessionId);
    
    if (!session) return undefined;

    if (session.callerSocketId === currentSocketId) {
      return session.recipientSocketId;
    } else if (session.recipientSocketId === currentSocketId) {
      return session.callerSocketId;
    }

    return undefined;
  }

  /**
   * Check if user is currently in a call
   */
  isUserInCall(userId: string): boolean {
    for (const session of this.activeCalls.values()) {
      if (
        (session.callerId === userId || session.recipientId === userId) &&
        session.status !== 'ended'
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Handle user disconnect - end all their calls
   */
  handleUserDisconnect(socketId: string): void {
    for (const [sessionId, session] of this.activeCalls) {
      if (
        session.callerSocketId === socketId ||
        session.recipientSocketId === socketId
      ) {
        this.endCall(sessionId);
      }
    }
  }

  /**
   * Get active calls count
   */
  getActiveCallsCount(): number {
    let count = 0;
    
    for (const session of this.activeCalls.values()) {
      if (session.status === 'active') {
        count++;
      }
    }
    
    return count;
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): CallSession | undefined {
    return this.activeCalls.get(sessionId);
  }

  /**
   * Cleanup old ended calls
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [sessionId, session] of this.activeCalls) {
      if (session.status === 'ended' && session.endTime) {
        if (now - session.endTime > maxAge) {
          this.activeCalls.delete(sessionId);
        }
      }
    }
  }

  /**
   * Get stats
   */
  getStats(): {
    totalCalls: number;
    activeCalls: number;
    ringingCalls: number;
  } {
    let active = 0;
    let ringing = 0;

    for (const session of this.activeCalls.values()) {
      if (session.status === 'active') active++;
      if (session.status === 'ringing') ringing++;
    }

    return {
      totalCalls: this.activeCalls.size,
      activeCalls: active,
      ringingCalls: ringing
    };
  }
}
