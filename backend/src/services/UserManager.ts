/**
 * User Manager Service
 * Manages connected users and their public keys
 */

export interface UserPublicKeys {
  kemPublicKey: string;
  dsaPublicKey: string;
}

export interface UserInfo {
  userId: string;
  socketId: string;
  publicKeys: UserPublicKeys;
  status: string;
  connectedAt: number;
}

export class UserManager {
  private users: Map<string, UserInfo> = new Map();
  private socketToUser: Map<string, string> = new Map();

  /**
   * Register a new user
   */
  registerUser(userId: string, socketId: string, publicKeys: UserPublicKeys): void {
    const userInfo: UserInfo = {
      userId,
      socketId,
      publicKeys,
      status: 'online',
      connectedAt: Date.now()
    };

    this.users.set(userId, userInfo);
    this.socketToUser.set(socketId, userId);
  }

  /**
   * Remove a user
   */
  removeUser(userId: string): void {
    const userInfo = this.users.get(userId);
    
    if (userInfo) {
      this.socketToUser.delete(userInfo.socketId);
      this.users.delete(userId);
    }
  }

  /**
   * Get user by socket ID
   */
  getUserBySocketId(socketId: string): string | undefined {
    return this.socketToUser.get(socketId);
  }

  /**
   * Get socket ID for a user
   */
  getSocketId(userId: string): string | undefined {
    return this.users.get(userId)?.socketId;
  }

  /**
   * Get user info
   */
  getUserInfo(userId: string): UserInfo | undefined {
    return this.users.get(userId);
  }

  /**
   * Get user's public keys
   */
  getPublicKeys(userId: string): UserPublicKeys | undefined {
    return this.users.get(userId)?.publicKeys;
  }

  /**
   * Update user status
   */
  updateUserStatus(userId: string, status: string): void {
    const userInfo = this.users.get(userId);
    
    if (userInfo) {
      userInfo.status = status;
    }
  }

  /**
   * Get list of online users
   */
  getOnlineUsers(): Array<{ userId: string; status: string; publicKeys: UserPublicKeys }> {
    return Array.from(this.users.values()).map(user => ({
      userId: user.userId,
      status: user.status,
      publicKeys: user.publicKeys
    }));
  }

  /**
   * Get count of online users
   */
  getOnlineUserCount(): number {
    return this.users.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.users.has(userId);
  }

  /**
   * Get all user IDs
   */
  getAllUserIds(): string[] {
    return Array.from(this.users.keys());
  }

  /**
   * Clear all users (for testing)
   */
  clearAll(): void {
    this.users.clear();
    this.socketToUser.clear();
  }
}
