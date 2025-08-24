/**
 * Universal authentication manager for multiplayer games
 * Extracted from Territory Conquest's dual-token authentication system
 */
export interface AuthConfig {
    jwtSecret: string;
    accessTokenTTL: string;
    refreshTokenTTL: string;
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
export declare abstract class AuthStorage {
    abstract createUser(email: string, username: string, passwordHash: string): Promise<User>;
    abstract getUserByEmail(email: string): Promise<(User & {
        passwordHash: string;
    }) | null>;
    abstract getUserByUsername(username: string): Promise<(User & {
        passwordHash: string;
    }) | null>;
    abstract getUserById(id: string): Promise<User | null>;
    abstract userExists(email: string, username?: string): Promise<{
        exists: boolean;
        field?: 'email' | 'username';
    }>;
    abstract storeRefreshToken(token: string, userId: string, expiresAt: Date): Promise<void>;
    abstract getRefreshToken(token: string): Promise<RefreshTokenData | null>;
    abstract deleteRefreshToken(token: string): Promise<void>;
    abstract deleteUserRefreshTokens(userId: string): Promise<void>;
    abstract cleanupExpiredTokens(): Promise<number>;
}
/**
 * Universal authentication manager
 */
export declare class AuthManager {
    private config;
    private storage;
    constructor(config: AuthConfig, storage: AuthStorage);
    /**
     * Register a new user
     */
    signup(email: string, username: string, password: string): Promise<AuthResult>;
    /**
     * Login with email and password
     */
    login(email: string, password: string): Promise<AuthResult>;
    /**
     * Refresh access token using refresh token
     */
    refreshAccessToken(refreshToken: string): Promise<AuthResult>;
    /**
     * Logout user by invalidating refresh token
     */
    logout(refreshToken?: string): Promise<void>;
    /**
     * Logout user from all devices
     */
    logoutAllDevices(userId: string): Promise<void>;
    /**
     * Verify and decode access token
     */
    verifyAccessToken(token: string): DecodedToken;
    /**
     * Get user from access token
     */
    getUserFromToken(token: string): Promise<User>;
    /**
     * Change user password
     */
    changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
    /**
     * Clean up expired refresh tokens
     */
    cleanupExpiredTokens(): Promise<number>;
    /**
     * Generate access and refresh token pair
     */
    private generateTokenPair;
    /**
     * Generate JWT access token
     */
    private generateAccessToken;
    /**
     * Generate cryptographically secure refresh token
     */
    private generateRefreshToken;
    /**
     * Hash password with bcrypt
     */
    private hashPassword;
    /**
     * Verify password against hash
     */
    private verifyPassword;
    /**
     * Validate password strength
     */
    private validatePassword;
    /**
     * Parse token expiry string (e.g., '15m', '7d') to milliseconds
     */
    private parseTokenExpiry;
    /**
     * Get cookie configuration
     */
    getCookieConfig(): Required<NonNullable<AuthConfig['cookieSettings']>>;
    /**
     * Get refresh token TTL in milliseconds
     */
    getRefreshTokenTTL(): number;
}
//# sourceMappingURL=AuthManager.d.ts.map