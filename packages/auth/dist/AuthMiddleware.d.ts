/**
 * Express.js middleware for authentication
 * Extracted from Territory Conquest's middleware system
 */
import type { Request, Response, NextFunction } from 'express';
import { AuthManager, User } from './AuthManager';
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}
export interface AuthMiddlewareConfig {
    authManager: AuthManager;
    skipPaths?: string[];
    tokenHeader?: string;
}
/**
 * Create authentication middleware
 */
export declare function createAuthMiddleware(config: AuthMiddlewareConfig): {
    /**
     * Require valid authentication
     */
    authenticate: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    /**
     * Optional authentication - doesn't fail if no token provided
     */
    optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Rate limiting middleware for auth endpoints
     */
    createRateLimit: (options: {
        windowMs: number;
        maxRequests: number;
    }) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
};
/**
 * Pre-configured middleware for common scenarios
 */
export declare class AuthMiddleware {
    private authManager;
    private middleware;
    constructor(authManager: AuthManager, config?: Omit<AuthMiddlewareConfig, 'authManager'>);
    /**
     * Standard authentication middleware
     */
    get authenticate(): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    /**
     * Optional authentication middleware
     */
    get optionalAuth(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Rate limit for auth endpoints (5 requests per 15 minutes)
     */
    get authRateLimit(): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    /**
     * More lenient rate limit for general API (100 requests per minute)
     */
    get apiRateLimit(): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    /**
     * Create auth routes for Express app
     */
    createAuthRoutes(): any;
    /**
     * Validation middleware for request bodies
     */
    static validateSignup: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
    static validateLogin: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
}
//# sourceMappingURL=AuthMiddleware.d.ts.map