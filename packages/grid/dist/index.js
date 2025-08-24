"use strict";
/**
 * @multiplayer-engine/grid
 *
 * Grid-based game engine specialization with spatial algorithms,
 * flood-fill operations, and chunk management.
 * Extracted from Territory Conquest game engine.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerritoryEngine = exports.ChunkManager = exports.GridManager = exports.GridGameEngine = void 0;
// Main grid engine
var GridGameEngine_1 = require("./GridGameEngine");
Object.defineProperty(exports, "GridGameEngine", { enumerable: true, get: function () { return GridGameEngine_1.GridGameEngine; } });
Object.defineProperty(exports, "GridManager", { enumerable: true, get: function () { return GridGameEngine_1.GridManager; } });
Object.defineProperty(exports, "ChunkManager", { enumerable: true, get: function () { return GridGameEngine_1.ChunkManager; } });
// Territory implementation (reference example)
var TerritoryEngine_1 = require("./TerritoryEngine");
Object.defineProperty(exports, "TerritoryEngine", { enumerable: true, get: function () { return TerritoryEngine_1.TerritoryEngine; } });
//# sourceMappingURL=index.js.map