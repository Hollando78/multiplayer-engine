"use strict";
/**
 * @multiplayer-engine/core
 *
 * Core abstractions and interfaces for multiplayer game engines.
 * Extracted from Territory Conquest game engine.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStatus = exports.GameStateUtils = exports.InMemoryGameStateManager = exports.GameStateManager = exports.InMemoryResourceManager = exports.ResourceManager = exports.MoveValidator = exports.BaseResourceManager = exports.GameEngine = void 0;
// Main engine abstractions
var GameEngine_1 = require("./GameEngine");
Object.defineProperty(exports, "GameEngine", { enumerable: true, get: function () { return GameEngine_1.GameEngine; } });
Object.defineProperty(exports, "BaseResourceManager", { enumerable: true, get: function () { return GameEngine_1.BaseResourceManager; } });
Object.defineProperty(exports, "MoveValidator", { enumerable: true, get: function () { return GameEngine_1.MoveValidator; } });
// Resource management system
var ResourceManager_1 = require("./ResourceManager");
Object.defineProperty(exports, "ResourceManager", { enumerable: true, get: function () { return ResourceManager_1.ResourceManager; } });
Object.defineProperty(exports, "InMemoryResourceManager", { enumerable: true, get: function () { return ResourceManager_1.InMemoryResourceManager; } });
// Game state management
var GameState_1 = require("./GameState");
Object.defineProperty(exports, "GameStateManager", { enumerable: true, get: function () { return GameState_1.GameStateManager; } });
Object.defineProperty(exports, "InMemoryGameStateManager", { enumerable: true, get: function () { return GameState_1.InMemoryGameStateManager; } });
Object.defineProperty(exports, "GameStateUtils", { enumerable: true, get: function () { return GameState_1.GameStateUtils; } });
Object.defineProperty(exports, "GameStatus", { enumerable: true, get: function () { return GameState_1.GameStatus; } });
//# sourceMappingURL=index.js.map