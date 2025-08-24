"use strict";
/**
 * Express.js middleware for authentication
 * Extracted from Territory Conquest's middleware system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMiddleware = void 0;
exports.createAuthMiddleware = createAuthMiddleware;
/**
 * Create authentication middleware
 */
function createAuthMiddleware(config) {
    const { authManager, skipPaths = [], tokenHeader = 'authorization' } = config;
    return {
        /**
         * Require valid authentication
         */
        authenticate: async (req, res, next) => {
            try {
                // Skip authentication for certain paths
                if (skipPaths.some(path => req.path.startsWith(path))) {
                    return next();
                }
                const authHeader = req.headers[tokenHeader];
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return res.status(401).json({
                        error: 'Missing or invalid authorization header',
                        code: 'MISSING_TOKEN'
                    });
                }
                const token = authHeader.substring(7);
                const user = await authManager.getUserFromToken(token);
                req.user = user;
                next();
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Authentication failed';
                return res.status(401).json({
                    error: message,
                    code: 'INVALID_TOKEN'
                });
            }
        },
        /**
         * Optional authentication - doesn't fail if no token provided
         */
        optionalAuth: async (req, res, next) => {
            try {
                const authHeader = req.headers[tokenHeader];
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return next();
                }
                const token = authHeader.substring(7);
                const user = await authManager.getUserFromToken(token);
                req.user = user;
                next();
            }
            catch (error) {
                // Continue without user if token is invalid
                next();
            }
        },
        /**
         * Rate limiting middleware for auth endpoints
         */
        createRateLimit: (options) => {
            const requests = new Map();
            return (req, res, next) => {
                const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
                const now = Date.now();
                const windowStart = now - options.windowMs;
                // Clean up old entries
                for (const [ip, data] of requests.entries()) {
                    if (data.resetTime < now) {
                        requests.delete(ip);
                    }
                }
                // Get or create client data
                let clientData = requests.get(clientIP);
                if (!clientData || clientData.resetTime < now) {
                    clientData = { count: 0, resetTime: now + options.windowMs };
                    requests.set(clientIP, clientData);
                }
                // Check rate limit
                if (clientData.count >= options.maxRequests) {
                    return res.status(429).json({
                        error: 'Too many requests',
                        code: 'RATE_LIMITED',
                        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
                    });
                }
                clientData.count++;
                next();
            };
        }
    };
}
/**
 * Pre-configured middleware for common scenarios
 */
class AuthMiddleware {
    authManager;
    middleware;
    constructor(authManager, config = {}) {
        this.authManager = authManager;
        this.middleware = createAuthMiddleware({
            authManager,
            ...config
        });
    }
    /**
     * Standard authentication middleware
     */
    get authenticate() {
        return this.middleware.authenticate;
    }
    /**
     * Optional authentication middleware
     */
    get optionalAuth() {
        return this.middleware.optionalAuth;
    }
    /**
     * Rate limit for auth endpoints (5 requests per 15 minutes)
     */
    get authRateLimit() {
        return this.middleware.createRateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 5
        });
    }
    /**
     * More lenient rate limit for general API (100 requests per minute)
     */
    get apiRateLimit() {
        return this.middleware.createRateLimit({
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 100
        });
    }
    /**
     * Create auth routes for Express app
     */
    createAuthRoutes() {
        const express = require('express');
        const router = express.Router();
        // Signup
        router.post('/signup', this.authRateLimit, async (req, res) => {
            try {
                const { email, username, password } = req.body;
                if (!email || !username || !password) {
                    return res.status(400).json({
                        error: 'Email, username, and password are required',
                        code: 'MISSING_FIELDS'
                    });
                }
                const result = await this.authManager.signup(email, username, password);
                // Set refresh token cookie
                const cookieConfig = this.authManager.getCookieConfig();
                const refreshTTL = this.authManager.getRefreshTokenTTL();
                res.cookie('refreshToken', result.tokens.refreshToken, {
                    ...cookieConfig,
                    maxAge: refreshTTL
                });
                res.status(201).json({
                    user: result.user,
                    accessToken: result.tokens.accessToken
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Signup failed';
                res.status(400).json({
                    error: message,
                    code: 'SIGNUP_FAILED'
                });
            }
        });
        // Login
        router.post('/login', this.authRateLimit, async (req, res) => {
            try {
                const { email, password } = req.body;
                if (!email || !password) {
                    return res.status(400).json({
                        error: 'Email and password are required',
                        code: 'MISSING_CREDENTIALS'
                    });
                }
                const result = await this.authManager.login(email, password);
                // Set refresh token cookie
                const cookieConfig = this.authManager.getCookieConfig();
                const refreshTTL = this.authManager.getRefreshTokenTTL();
                res.cookie('refreshToken', result.tokens.refreshToken, {
                    ...cookieConfig,
                    maxAge: refreshTTL
                });
                res.json({
                    user: result.user,
                    accessToken: result.tokens.accessToken
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Login failed';
                res.status(401).json({
                    error: message,
                    code: 'LOGIN_FAILED'
                });
            }
        });
        // Refresh token
        router.post('/refresh', async (req, res) => {
            try {
                const { refreshToken } = req.cookies;
                if (!refreshToken) {
                    return res.status(401).json({
                        error: 'Refresh token required',
                        code: 'MISSING_REFRESH_TOKEN'
                    });
                }
                const result = await this.authManager.refreshAccessToken(refreshToken);
                res.json({
                    user: result.user,
                    accessToken: result.tokens.accessToken
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Token refresh failed';
                res.status(401).json({
                    error: message,
                    code: 'REFRESH_FAILED'
                });
            }
        });
        // Logout
        router.post('/logout', async (req, res) => {
            try {
                const { refreshToken } = req.cookies;
                await this.authManager.logout(refreshToken);
                res.clearCookie('refreshToken', this.authManager.getCookieConfig());
                res.json({ message: 'Logged out successfully' });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Logout failed';
                res.status(500).json({
                    error: message,
                    code: 'LOGOUT_FAILED'
                });
            }
        });
        // Get current user
        router.get('/me', this.authenticate, (req, res) => {
            res.json({ user: req.user });
        });
        return router;
    }
    /**
     * Validation middleware for request bodies
     */
    static validateSignup = (req, res, next) => {
        const { email, username, password } = req.body;
        const errors = [];
        if (!email || !email.includes('@')) {
            errors.push('Valid email is required');
        }
        if (!username || username.length < 3) {
            errors.push('Username must be at least 3 characters');
        }
        if (!password || password.length < 8) {
            errors.push('Password must be at least 8 characters');
        }
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors,
                code: 'VALIDATION_ERROR'
            });
        }
        next();
    };
    static validateLogin = (req, res, next) => {
        const { email, password } = req.body;
        const errors = [];
        if (!email) {
            errors.push('Email is required');
        }
        if (!password) {
            errors.push('Password is required');
        }
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors,
                code: 'VALIDATION_ERROR'
            });
        }
        next();
    };
}
exports.AuthMiddleware = AuthMiddleware;
//# sourceMappingURL=AuthMiddleware.js.map