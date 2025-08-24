"use strict";
/**
 * Universal authentication manager for multiplayer games
 * Extracted from Territory Conquest's dual-token authentication system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthManager = exports.AuthStorage = void 0;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto_1 = require("crypto");
/**
 * Abstract storage interface for authentication data
 */
class AuthStorage {
}
exports.AuthStorage = AuthStorage;
/**
 * Universal authentication manager
 */
class AuthManager {
    config;
    storage;
    constructor(config, storage) {
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
    async signup(email, username, password) {
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
    async login(email, password) {
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
    async refreshAccessToken(refreshToken) {
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
    async logout(refreshToken) {
        if (refreshToken) {
            await this.storage.deleteRefreshToken(refreshToken);
        }
    }
    /**
     * Logout user from all devices
     */
    async logoutAllDevices(userId) {
        await this.storage.deleteUserRefreshTokens(userId);
    }
    /**
     * Verify and decode access token
     */
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, this.config.jwtSecret);
            if (decoded.type !== 'access') {
                throw new Error('Invalid token type');
            }
            return decoded;
        }
        catch (error) {
            throw new Error('Invalid or expired access token');
        }
    }
    /**
     * Get user from access token
     */
    async getUserFromToken(token) {
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
    async changePassword(userId, oldPassword, newPassword) {
        // Get user with password hash
        const userWithHash = await this.storage.getUserByIdWithHash?.(userId);
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
        await this.storage.updatePassword?.(userId, newPasswordHash);
        // Logout from all devices to force re-authentication
        await this.logoutAllDevices(userId);
    }
    /**
     * Clean up expired refresh tokens
     */
    async cleanupExpiredTokens() {
        return await this.storage.cleanupExpiredTokens();
    }
    /**
     * Generate access and refresh token pair
     */
    async generateTokenPair(userId) {
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
    generateAccessToken(userId) {
        return jwt.sign({ userId, type: 'access' }, this.config.jwtSecret, { expiresIn: this.config.accessTokenTTL });
    }
    /**
     * Generate cryptographically secure refresh token
     */
    generateRefreshToken() {
        return (0, crypto_1.randomBytes)(32).toString('hex');
    }
    /**
     * Hash password with bcrypt
     */
    async hashPassword(password) {
        return bcrypt.hash(password, this.config.bcryptRounds);
    }
    /**
     * Verify password against hash
     */
    async verifyPassword(password, hash) {
        return bcrypt.compare(password, hash);
    }
    /**
     * Validate password strength
     */
    validatePassword(password) {
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
    parseTokenExpiry(ttl) {
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
        return parseInt(value) * units[unit];
    }
    /**
     * Get cookie configuration
     */
    getCookieConfig() {
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
    getRefreshTokenTTL() {
        return this.parseTokenExpiry(this.config.refreshTokenTTL);
    }
}
exports.AuthManager = AuthManager;
//# sourceMappingURL=AuthManager.js.map