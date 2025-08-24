/**
 * Universal authentication manager for multiplayer games
 * Extracted from Territory Conquest's dual-token authentication system
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
import { randomBytes } from 'crypto';

export interface AuthConfig {
  jwtSecret: string;
  accessTokenTTL: string; // e.g., '15m'
  refreshTokenTTL: string; // e.g., '7d'
  bcryptRounds: number;
  cookieSettings?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt?: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface DecodedToken {
  userId: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshTokenData {
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Abstract storage interface for authentication data
 */
export abstract class AuthStorage {
  abstract createUser(email: string, username: string, passwordHash: string): Promise<User>;
  abstract getUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null>;
  abstract getUserByUsername(username: string): Promise<(User & { passwordHash: string }) | null>;
  abstract getUserById(id: string): Promise<User | null>;
  abstract userExists(email: string, username?: string): Promise<{ exists: boolean; field?: 'email' | 'username' }>;
  
  abstract storeRefreshToken(token: string, userId: string, expiresAt: Date): Promise<void>;
  abstract getRefreshToken(token: string): Promise<RefreshTokenData | null>;
  abstract deleteRefreshToken(token: string): Promise<void>;
  abstract deleteUserRefreshTokens(userId: string): Promise<void>;
  abstract cleanupExpiredTokens(): Promise<number>;
}

/**
 * Universal authentication manager
 */
export class AuthManager {
  private config: AuthConfig;
  private storage: AuthStorage;

  constructor(config: AuthConfig, storage: AuthStorage) {
    this.config = config;
    this.storage = storage;
    
    // Validate configuration
    if (!config.jwtSecret || config.jwtSecret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long');
    }
  }

  /**
   * Register a new user
   */
  async signup(email: string, username: string, password: string): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await this.storage.userExists(email, username);
    if (existingUser.exists) {
      throw new Error(`${existingUser.field} already taken`);
    }

    // Validate password strength
    this.validatePassword(password);

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user = await this.storage.createUser(email, username, passwordHash);

    // Generate tokens
    const tokens = await this.generateTokenPair(user.id);

    return { user, tokens };
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<AuthResult> {
    // Get user by email
    const userWithHash = await this.storage.getUserByEmail(email);
    if (!userWithHash) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await this.verifyPassword(password, userWithHash.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokenPair(userWithHash.id);

    // Return user without password hash
    const { passwordHash, ...user } = userWithHash;
    return { user, tokens };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    // Get refresh token from storage
    const tokenData = await this.storage.getRefreshToken(refreshToken);
    if (!tokenData || tokenData.expiresAt < new Date()) {
      // Clean up expired token
      if (tokenData) {
        await this.storage.deleteRefreshToken(refreshToken);
      }
      throw new Error('Invalid or expired refresh token');
    }

    // Get user
    const user = await this.storage.getUserById(tokenData.userId);
    if (!user) {
      await this.storage.deleteRefreshToken(refreshToken);
      throw new Error('User not found');
    }

    // Generate new access token (keep same refresh token)
    const accessToken = this.generateAccessToken(user.id);
    const tokens = { accessToken, refreshToken };

    return { user, tokens };
  }

  /**
   * Logout user by invalidating refresh token
   */
  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.storage.deleteRefreshToken(refreshToken);
    }
  }

  /**
   * Logout user from all devices
   */
  async logoutAllDevices(userId: string): Promise<void> {
    await this.storage.deleteUserRefreshTokens(userId);
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): DecodedToken {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Get user from access token
   */
  async getUserFromToken(token: string): Promise<User> {
    const decoded = this.verifyAccessToken(token);
    const user = await this.storage.getUserById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    // Get user with password hash
    const userWithHash = await (this.storage as any).getUserByIdWithHash?.(userId);
    if (!userWithHash) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await this.verifyPassword(oldPassword, userWithHash.passwordHash);
    if (!isValid) {
      throw new Error('Invalid current password');
    }

    // Validate new password
    this.validatePassword(newPassword);

    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword);

    // Update password
    await (this.storage as any).updatePassword?.(userId, newPasswordHash);

    // Logout from all devices to force re-authentication
    await this.logoutAllDevices(userId);
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    return await this.storage.cleanupExpiredTokens();
  }

  /**
   * Generate access and refresh token pair
   */
  private async generateTokenPair(userId: string): Promise<AuthTokens> {
    const accessToken = this.generateAccessToken(userId);
    const refreshToken = this.generateRefreshToken();

    // Store refresh token
    const refreshTTL = this.parseTokenExpiry(this.config.refreshTokenTTL);
    const expiresAt = new Date(Date.now() + refreshTTL);
    await this.storage.storeRefreshToken(refreshToken, userId, expiresAt);

    return { accessToken, refreshToken };
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'access' },
      this.config.jwtSecret,
      { expiresIn: this.config.accessTokenTTL }
    );
  }

  /**
   * Generate cryptographically secure refresh token
   */
  private generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hash password with bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.bcryptRounds);
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    
    // Optional: Check for special characters
    // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    //   throw new Error('Password must contain at least one special character');
    // }
  }

  /**
   * Parse token expiry string (e.g., '15m', '7d') to milliseconds
   */
  private parseTokenExpiry(ttl: string): number {
    const units = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid TTL format. Use format like "15m", "7d", "2h"');
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit as keyof typeof units];
  }

  /**
   * Get cookie configuration
   */
  getCookieConfig(): Required<NonNullable<AuthConfig['cookieSettings']>> {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      ...this.config.cookieSettings
    };
  }

  /**
   * Get refresh token TTL in milliseconds
   */
  getRefreshTokenTTL(): number {
    return this.parseTokenExpiry(this.config.refreshTokenTTL);
  }
}