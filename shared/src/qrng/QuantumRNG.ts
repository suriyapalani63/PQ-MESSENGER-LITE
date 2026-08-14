/**
 * Quantum Random Number Generator Client
 * Integrates with ANU Quantum Random Numbers Server
 * https://qrng.anu.edu.au/
 */

import axios from 'axios';

export interface QRNGConfig {
  apiUrl?: string;
  timeout?: number;
  fallbackToCSPRNG?: boolean;
}

export interface QRNGResponse {
  type: string;
  length: number;
  data: number[];
  success: boolean;
}

export class QuantumRNG {
  private apiUrl: string;
  private timeout: number;
  private fallbackToCSPRNG: boolean;

  constructor(config: QRNGConfig = {}) {
    this.apiUrl = config.apiUrl || 'https://qrng.anu.edu.au/API/jsonI.php';
    this.timeout = config.timeout || 10000;
    this.fallbackToCSPRNG = config.fallbackToCSPRNG ?? true;
  }

  /**
   * Get quantum random bytes
   * @param length Number of bytes to generate (max 1024 per request)
   * @returns Buffer of random bytes
   */
  async getRandomBytes(length: number): Promise<Buffer> {
    if (length <= 0 || length > 1024) {
      throw new Error('Length must be between 1 and 1024 bytes');
    }

    try {
      const response = await this.fetchQuantumRandom('uint8', length);
      
      if (response.success && response.data) {
        return Buffer.from(response.data);
      }
      
      throw new Error('Failed to get quantum random data');
    } catch (error) {
      console.warn('QRNG API error:', error);
      
      if (this.fallbackToCSPRNG) {
        console.log('Falling back to cryptographically secure PRNG');
        return this.getCSPRNGBytes(length);
      }
      
      throw error;
    }
  }

  /**
   * Get quantum random integers
   * @param length Number of integers to generate
   * @param min Minimum value (inclusive)
   * @param max Maximum value (exclusive)
   * @returns Array of random integers
   */
  async getRandomIntegers(length: number, min: number = 0, max: number = 256): Promise<number[]> {
    const bytes = await this.getRandomBytes(length);
    const range = max - min;
    
    return Array.from(bytes).map(byte => min + (byte % range));
  }

  /**
   * Get a single quantum random number
   * @param min Minimum value (inclusive)
   * @param max Maximum value (exclusive)
   * @returns Random number
   */
  async getRandomNumber(min: number = 0, max: number = 1): Promise<number> {
    const bytes = await this.getRandomBytes(8);
    const uint64 = this.bytesToUint64(bytes);
    
    // Normalize to [0, 1)
    const normalized = uint64 / (2 ** 64);
    
    // Scale to [min, max)
    return min + normalized * (max - min);
  }

  /**
   * Generate a quantum random UUID v4
   * @returns UUID string
   */
  async generateUUID(): Promise<string> {
    const bytes = await this.getRandomBytes(16);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  /**
   * Generate quantum random encryption key
   * @param bits Key size in bits (128, 192, or 256)
   * @returns Buffer containing the key
   */
  async generateKey(bits: number = 256): Promise<Buffer> {
    if (![128, 192, 256].includes(bits)) {
      throw new Error('Key size must be 128, 192, or 256 bits');
    }
    
    const bytes = bits / 8;
    return await this.getRandomBytes(bytes);
  }

  /**
   * Generate quantum random nonce/IV
   * @param length Length in bytes (typically 12 or 16)
   * @returns Buffer containing the nonce
   */
  async generateNonce(length: number = 12): Promise<Buffer> {
    return await this.getRandomBytes(length);
  }

  /**
   * Fetch quantum random data from ANU API
   * @private
   */
  private async fetchQuantumRandom(type: string, length: number): Promise<QRNGResponse> {
    const url = `${this.apiUrl}?length=${length}&type=${type}`;
    
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: {
        'Accept': 'application/json'
      }
    });

    return response.data;
  }

  /**
   * Fallback CSPRNG using crypto.getRandomValues or crypto.randomBytes
   * @private
   */
  private getCSPRNGBytes(length: number): Buffer {
    // Node.js environment
    if (typeof require !== 'undefined') {
      try {
        const crypto = require('crypto');
        return crypto.randomBytes(length);
      } catch (e) {
        // Fall through to browser implementation
      }
    }

    // Browser environment
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(length);
      window.crypto.getRandomValues(bytes);
      return Buffer.from(bytes);
    }

    throw new Error('No CSPRNG available');
  }

  /**
   * Convert bytes to uint64
   * @private
   */
  private bytesToUint64(bytes: Buffer): number {
    let result = 0;
    for (let i = 0; i < 8; i++) {
      result = result * 256 + bytes[i];
    }
    return result;
  }

  /**
   * Test QRNG connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const bytes = await this.getRandomBytes(1);
      return bytes.length === 1;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get QRNG statistics and health
   */
  async getStats(): Promise<{ available: boolean; source: string }> {
    try {
      await this.getRandomBytes(1);
      return { available: true, source: 'quantum' };
    } catch (error) {
      return { 
        available: this.fallbackToCSPRNG, 
        source: this.fallbackToCSPRNG ? 'csprng-fallback' : 'unavailable' 
      };
    }
  }
}

// Export singleton instance
export const qrng = new QuantumRNG();
