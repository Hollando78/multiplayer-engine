"use strict";
/**
 * @multiplayer-engine/realtime
 *
 * Real-time multiplayer infrastructure with WebSocket and Redis pub/sub.
 * Provides chunk-based updates, optimistic synchronization, and distributed state management.
 * Extracted from Territory Conquest's real-time multiplayer systems.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultClientConfig = exports.SocketClient = exports.StateSync = exports.ViewportUtils = exports.ChunkUpdater = exports.PubSubManager = exports.defaultSocketConfig = exports.SocketManager = void 0;
// Server-side components
var SocketManager_1 = require("./SocketManager");
Object.defineProperty(exports, "SocketManager", { enumerable: true, get: function () { return SocketManager_1.SocketManager; } });
Object.defineProperty(exports, "defaultSocketConfig", { enumerable: true, get: function () { return SocketManager_1.defaultSocketConfig; } });
var PubSubManager_1 = require("./PubSubManager");
Object.defineProperty(exports, "PubSubManager", { enumerable: true, get: function () { return PubSubManager_1.PubSubManager; } });
var ChunkUpdater_1 = require("./ChunkUpdater");
Object.defineProperty(exports, "ChunkUpdater", { enumerable: true, get: function () { return ChunkUpdater_1.ChunkUpdater; } });
Object.defineProperty(exports, "ViewportUtils", { enumerable: true, get: function () { return ChunkUpdater_1.ViewportUtils; } });
var StateSync_1 = require("./StateSync");
Object.defineProperty(exports, "StateSync", { enumerable: true, get: function () { return StateSync_1.StateSync; } });
// Client-side components
var SocketClient_1 = require("./SocketClient");
Object.defineProperty(exports, "SocketClient", { enumerable: true, get: function () { return SocketClient_1.SocketClient; } });
Object.defineProperty(exports, "defaultClientConfig", { enumerable: true, get: function () { return SocketClient_1.defaultClientConfig; } });
//# sourceMappingURL=index.js.map