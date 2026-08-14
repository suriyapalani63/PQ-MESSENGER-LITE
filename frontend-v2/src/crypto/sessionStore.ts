/**
 * sessionStore.ts — Memory store for active PQC sessions
 * 
 * Stores the derived symmetric keys and ratchet counters for active conversations.
 * Indexed by the stable sorted conversation ID.
 */

interface RatchetChain {
  key: Uint8Array;
  counter: number;
}

interface SessionState {
  // Key used to encrypt messages we send
  sendChain: RatchetChain;
  // Key used to decrypt messages we receive
  receiveChain: RatchetChain;
  isEstablished: boolean;
}

const sessions = new Map<string, SessionState>();

export function getSession(conversationId: string): SessionState | undefined {
  return sessions.get(conversationId);
}

export function initSession(
  conversationId: string,
  sendKey: Uint8Array,
  receiveKey: Uint8Array
): void {
  sessions.set(conversationId, {
    sendChain: { key: sendKey, counter: 0 },
    receiveChain: { key: receiveKey, counter: 0 },
    isEstablished: true
  });
}

export function advanceSendCounter(conversationId: string): number {
  const session = sessions.get(conversationId);
  if (!session) throw new Error('Session not found');
  const count = session.sendChain.counter++;
  return count;
}

export function checkAndAdvanceReceiveCounter(conversationId: string, counter: number): boolean {
  const session = sessions.get(conversationId);
  if (!session) return false;
  
  if (counter <= session.receiveChain.counter && counter !== 0) {
    console.warn(`Out-of-order or duplicate message. Expected > ${session.receiveChain.counter}, got ${counter}`);
    return false;
  }
  
  session.receiveChain.counter = counter;
  return true;
}

export function clearSession(conversationId: string): void {
  sessions.delete(conversationId);
}
