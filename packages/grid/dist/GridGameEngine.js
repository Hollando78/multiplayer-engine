"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkManager = exports.GridManager = exports.GridGameEngine = void 0;
const core_1 = require("@multiplayer-engine/core");
/**
 * Abstract base class for grid-based games
 */
class GridGameEngine extends core_1.GameEngine {
    grid;
    chunkManager;
    constructor(gameId, rules) {
        super(gameId, rules);
        this.grid = new GridManager(rules.gridOptions);
        this.chunkManager = new ChunkManager(rules.gridOptions.chunkSize || 64);
    }
    /**
     * Standard move validation - delegates to canPlaceAt
     */
    async validateMove(playerId, moveData) {
        return await this.canPlaceAt(moveData.x, moveData.y, playerId);
    }
    /**
     * Standard move application - delegates to applyGridMove
     */
    async applyMove(playerId, moveData) {
        const result = await this.applyGridMove(moveData.x, moveData.y, playerId);
        return {
            success: result.success,
            error: result.error,
            changedCells: result.changedCells,
            affectedChunks: result.affectedChunks
        };
    }
    /**
     * Get all cells in a rectangular region
     */
    async getCellsInRegion(minX, maxX, minY, maxY) {
        const cells = await this.loadCells({ minX, maxX, minY, maxY });
        const cellMap = new Map();
        cells.forEach(cell => {
            cellMap.set(`${cell.x},${cell.y}`, cell.owner || null);
        });
        return cellMap;
    }
    /**
     * Get 4-connected neighbors
     */
    get4Neighbors(x, y) {
        return [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 }
        ];
    }
    /**
     * Get 8-connected neighbors (including diagonals)
     */
    get8Neighbors(x, y) {
        return [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 },
            { x: x + 1, y: y + 1 },
            { x: x + 1, y: y - 1 },
            { x: x - 1, y: y + 1 },
            { x: x - 1, y: y - 1 }
        ];
    }
    /**
     * Generic flood fill algorithm for finding connected regions
     */
    floodFill(startX, startY, predicate, cellMap, bounds) {
        const region = [];
        const visited = new Set();
        const queue = [{ x: startX, y: startY }];
        const startKey = `${startX},${startY}`;
        let isEnclosed = true;
        const startOwner = cellMap.get(startKey) || null;
        visited.add(startKey);
        const MAX_REGION_SIZE = 500; // Prevent infinite loops
        while (queue.length > 0 && region.length < MAX_REGION_SIZE) {
            const current = queue.shift();
            region.push(current);
            // Check if we've hit boundaries (means not enclosed if infinite grid)
            if (bounds && (current.x <= bounds.minX || current.x >= bounds.maxX ||
                current.y <= bounds.minY || current.y >= bounds.maxY)) {
                isEnclosed = false;
            }
            // Check 4-connected neighbors
            const neighbors = this.get4Neighbors(current.x, current.y);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                if (visited.has(neighborKey))
                    continue;
                const neighborOwner = cellMap.get(neighborKey) || null;
                // Apply predicate to determine if we should include this neighbor
                if (predicate(neighbor.x, neighbor.y, neighborOwner)) {
                    visited.add(neighborKey);
                    queue.push(neighbor);
                }
            }
        }
        if (region.length >= MAX_REGION_SIZE) {
            isEnclosed = false;
        }
        return { cells: region, isEnclosed, owner: startOwner };
    }
    /**
     * Find enclosed areas that should be captured
     * This is the sophisticated algorithm from Territory game
     */
    findEnclosedAreas(cellMap, playerColour, _searchRadius = 25) {
        const enclosedCells = [];
        const processedCells = new Set();
        // Get bounds of the search area
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        cellMap.forEach((_owner, key) => {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });
        // Expand search bounds slightly
        minX -= 2;
        maxX += 2;
        minY -= 2;
        maxY += 2;
        // Check every cell in the bounded region
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                if (processedCells.has(key))
                    continue;
                const owner = cellMap.get(key);
                if (owner === playerColour)
                    continue;
                // Flood fill from this position to find connected region
                const region = this.floodFillRegion(cellMap, x, y, playerColour, minX, maxX, minY, maxY);
                // Mark all cells in region as processed
                region.cells.forEach(cell => {
                    processedCells.add(`${cell.x},${cell.y}`);
                });
                // If region is enclosed, add to conversion list
                if (region.isEnclosed) {
                    region.cells.forEach(cell => {
                        enclosedCells.push({
                            x: cell.x,
                            y: cell.y,
                            owner: playerColour,
                            data: { oldOwner: cellMap.get(`${cell.x},${cell.y}`) }
                        });
                    });
                }
            }
        }
        return enclosedCells;
    }
    /**
     * Flood fill to find a connected region and determine if it's enclosed
     */
    floodFillRegion(cellMap, startX, startY, playerColour, minX, maxX, minY, maxY) {
        return this.floodFill(startX, startY, (_x, _y, owner) => owner !== playerColour, // Include non-player cells
        cellMap, { minX, maxX, minY, maxY });
    }
    /**
     * Get affected chunks from cell changes
     */
    getAffectedChunks(changedCells) {
        const chunkSize = this.chunkManager.chunkSize;
        const chunks = new Set();
        changedCells.forEach(cell => {
            const chunkX = Math.floor(cell.x / chunkSize);
            const chunkY = Math.floor(cell.y / chunkSize);
            chunks.add(`${chunkX},${chunkY}`);
        });
        return Array.from(chunks);
    }
}
exports.GridGameEngine = GridGameEngine;
/**
 * Grid manager for coordinate and spatial operations
 */
class GridManager {
    options;
    constructor(options = {}) {
        this.options = {
            infinite: true,
            chunkSize: 64,
            maxBoundingBox: 30,
            ...options
        };
    }
    /**
     * Check if coordinates are within bounds (for finite grids)
     */
    isInBounds(x, y) {
        if (this.options.infinite)
            return true;
        return x >= 0 && x < (this.options.width || 0) &&
            y >= 0 && y < (this.options.height || 0);
    }
    /**
     * Calculate distance between two points
     */
    getDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    /**
     * Get all cells within a radius
     */
    getCellsInRadius(centerX, centerY, radius) {
        const cells = [];
        const radiusSquared = radius * radius;
        for (let x = centerX - radius; x <= centerX + radius; x++) {
            for (let y = centerY - radius; y <= centerY + radius; y++) {
                if (this.isInBounds(x, y)) {
                    const distanceSquared = (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY);
                    if (distanceSquared <= radiusSquared) {
                        cells.push({ x, y });
                    }
                }
            }
        }
        return cells;
    }
}
exports.GridManager = GridManager;
/**
 * Chunk manager for efficient grid operations
 */
class ChunkManager {
    chunkSize;
    constructor(chunkSize = 64) {
        this.chunkSize = chunkSize;
    }
    /**
     * Convert world coordinates to chunk coordinates
     */
    getChunkCoords(x, y) {
        return {
            chunkX: Math.floor(x / this.chunkSize),
            chunkY: Math.floor(y / this.chunkSize)
        };
    }
    /**
     * Get all chunks that intersect with a bounding box
     */
    getChunksInBounds(minX, maxX, minY, maxY) {
        const chunks = [];
        const minChunkX = Math.floor(minX / this.chunkSize);
        const maxChunkX = Math.floor(maxX / this.chunkSize);
        const minChunkY = Math.floor(minY / this.chunkSize);
        const maxChunkY = Math.floor(maxY / this.chunkSize);
        for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
                chunks.push(`${chunkX},${chunkY}`);
            }
        }
        return chunks;
    }
}
exports.ChunkManager = ChunkManager;
//# sourceMappingURL=GridGameEngine.js.map