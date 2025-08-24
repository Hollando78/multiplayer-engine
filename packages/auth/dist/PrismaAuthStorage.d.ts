/**
 * Prisma implementation of AuthStorage
 * Compatible with Territory Conquest's database schema
 */
import type { PrismaClient } from '@prisma/client';
import { AuthStorage, User, RefreshTokenData } from './AuthManager';
export declare class PrismaAuthStorage extends AuthStorage {
    private prisma;
    constructor(prisma: PrismaClient);
    /**
     * Create new user in database
     */
    createUser(email: string, username: string, passwordHash: string): Promise<User>;
    /**
     * Get user by email with password hash
     */
    getUserByEmail(email: string): Promise<(User & {
        passwordHash: string;
    }) | null>;
    /**
     * Get user by username with password hash
     */
    getUserByUsername(username: string): Promise<(User & {
        passwordHash: string;
    }) | null>;
    /**
     * Get user by ID without password hash
     */
    getUserById(id: string): Promise<User | null>;
    /**
     * Check if user exists by email or username
     */
    userExists(email: string, username?: string): Promise<{
        exists: boolean;
        field?: 'email' | 'username';
    }>;
    /**
     * Store refresh token in database
     */
    storeRefreshToken(token: string, userId: string, expiresAt: Date): Promise<void>;
    /**
     * Get refresh token from database
     */
    getRefreshToken(token: string): Promise<RefreshTokenData | null>;
    /**
     * Delete refresh token from database
     */
    deleteRefreshToken(token: string): Promise<void>;
    /**
     * Delete all refresh tokens for a user
     */
    deleteUserRefreshTokens(userId: string): Promise<void>;
    /**
     * Clean up expired refresh tokens
     */
    cleanupExpiredTokens(): Promise<number>;
    /**
     * Update user password (for password change functionality)
     */
    updatePassword(userId: string, passwordHash: string): Promise<void>;
    /**
     * Get user by ID with password hash (for password changes)
     */
    getUserByIdWithHash(userId: string): Promise<(User & {
        passwordHash: string;
    }) | null>;
}
//# sourceMappingURL=PrismaAuthStorage.d.ts.map