/**
 * Prisma implementation of AuthStorage
 * Compatible with Territory Conquest's database schema
 */

import type { PrismaClient } from '@prisma/client';
import { AuthStorage, User, RefreshTokenData } from '@multiplayer-engine/auth';

export class PrismaAuthStorage extends AuthStorage {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
  }

  /**
   * Create new user in database
   */
  async createUser(email: string, username: string, passwordHash: string): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        passwordHash
      },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true
      }
    });

    return user;
  }

  /**
   * Get user by email with password hash
   */
  async getUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        createdAt: true
      }
    });

    return user;
  }

  /**
   * Get user by username with password hash
   */
  async getUserByUsername(username: string): Promise<(User & { passwordHash: string }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        createdAt: true
      }
    });

    return user;
  }

  /**
   * Get user by ID without password hash
   */
  async getUserById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        createdAt: true
      }
    });

    return user;
  }

  /**
   * Check if user exists by email or username
   */
  async userExists(email: string, username?: string): Promise<{ exists: boolean; field?: 'email' | 'username' }> {
    // Check email first
    const userByEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (userByEmail) {
      return { exists: true, field: 'email' };
    }

    // Check username if provided
    if (username) {
      const userByUsername = await this.prisma.user.findUnique({
        where: { username },
        select: { id: true }
      });

      if (userByUsername) {
        return { exists: true, field: 'username' };
      }
    }

    return { exists: false };
  }

  /**
   * Store refresh token in database
   */
  async storeRefreshToken(token: string, userId: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt
      }
    });
  }

  /**
   * Get refresh token from database
   */
  async getRefreshToken(token: string): Promise<RefreshTokenData | null> {
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      select: {
        token: true,
        userId: true,
        expiresAt: true,
        createdAt: true
      }
    });

    return refreshToken;
  }

  /**
   * Delete refresh token from database
   */
  async deleteRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.delete({
      where: { token }
    });
  }

  /**
   * Delete all refresh tokens for a user
   */
  async deleteUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId }
    });
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return result.count;
  }

  /**
   * Update user password (for password change functionality)
   */
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
  }

  /**
   * Get user by ID with password hash (for password changes)
   */
  async getUserByIdWithHash(userId: string): Promise<(User & { passwordHash: string }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        createdAt: true
      }
    });

    return user;
  }
}