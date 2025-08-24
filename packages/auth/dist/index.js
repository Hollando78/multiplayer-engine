"use strict";
/**
 * @multiplayer-engine/auth - Universal authentication system
 * Extracted from Territory Conquest's dual-token authentication
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthMiddleware = exports.AuthMiddleware = exports.AuthStorage = exports.AuthManager = void 0;
var AuthManager_1 = require("./AuthManager");
Object.defineProperty(exports, "AuthManager", { enumerable: true, get: function () { return AuthManager_1.AuthManager; } });
Object.defineProperty(exports, "AuthStorage", { enumerable: true, get: function () { return AuthManager_1.AuthStorage; } });
var AuthMiddleware_1 = require("./AuthMiddleware");
Object.defineProperty(exports, "AuthMiddleware", { enumerable: true, get: function () { return AuthMiddleware_1.AuthMiddleware; } });
Object.defineProperty(exports, "createAuthMiddleware", { enumerable: true, get: function () { return AuthMiddleware_1.createAuthMiddleware; } });
// export { PrismaAuthStorage } from './PrismaAuthStorage';
//# sourceMappingURL=index.js.map