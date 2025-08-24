"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerritoryEngine = void 0;
const core_1 = require("@multiplayer-engine/core");
const GridGameEngine_1 = require("./GridGameEngine");
/**
 * Territory Conquest game engine implementation
 */
class TerritoryEngine extends GridGameEngine_1.GridGameEngine {
    constructor(gameId) {
        const rules = {
            gridOptions: {
                infinite: true,
                chunkSize: 64,
                maxBoundingBox: 30
            },
            resources: {
                max: 25,
                regenSeconds: 60,
                starting: 5
            }
        };
        super(gameId, rules);
    }
    createResourceManager() {
        return new core_1.InMemoryResourceManager(this.rules.resources);
    }
    createMoveValidator() {
        return new TerritoryMoveValidator();
    }
    /**
     * Territory-specific placement validation
     */
    async canPlaceAt(x, y, playerId, isFirstMove = false) {
        if (isFirstMove) {
            return true;
        }
        // Check for standard 4-adjacent owned cells
        const neighbors4 = this.get4Neighbors(x, y);
        const boundingBox = this.rules.gridOptions.maxBoundingBox || 30;
        const cellMap = await this.getCellsInRegion(x - boundingBox, x + boundingBox, y - boundingBox, y + boundingBox);
        // Standard adjacency rule
        for (const neighbor of neighbors4) {
            const owner = cellMap.get(`${neighbor.x},${neighbor.y}`);
            if (owner === playerId) {
                return true;
            }
        }
        // Check for diagonal tunneling exception
        return await this.canTunnelDiagonally(x, y, playerId, cellMap);
    }
    /**
     * Diagonal tunneling mechanic from Territory game
     */
    async canTunnelDiagonally(x, y, playerColour, cellMap) {
        const diagonalNeighbors = [
            { x: x + 1, y: y + 1 }, // Bottom-right
            { x: x + 1, y: y - 1 }, // Top-right  
            { x: x - 1, y: y + 1 }, // Bottom-left
            { x: x - 1, y: y - 1 } // Top-left
        ];
        // Check each diagonal neighbor
        for (const diagonal of diagonalNeighbors) {
            const diagonalOwner = cellMap.get(`${diagonal.x},${diagonal.y}`);
            // Must have a diagonally adjacent owned cell
            if (diagonalOwner === playerColour) {
                // Find the two 4-adjacent cells that form the "corner"
                const corner1 = { x: diagonal.x, y };
                const corner2 = { x, y: diagonal.y };
                const corner1Owner = cellMap.get(`${corner1.x},${corner1.y}`);
                const corner2Owner = cellMap.get(`${corner2.x},${corner2.y}`);
                // Both corner cells must be owned by opponents
                if (corner1Owner !== null && corner1Owner !== undefined && corner1Owner !== playerColour &&
                    corner2Owner !== null && corner2Owner !== undefined && corner2Owner !== playerColour) {
                    return true; // Diagonal tunneling allowed
                }
            }
        }
        return false;
    }
    /**
     * Apply territory move with all the sophisticated mechanics
     */
    async applyGridMove(x, y, playerColour) {
        const boundingBox = this.rules.gridOptions.maxBoundingBox || 30;
        const minX = x - boundingBox;
        const maxX = x + boundingBox;
        const minY = y - boundingBox;
        const maxY = y + boundingBox;
        const localCells = await this.getCellsInRegion(minX, maxX, minY, maxY);
        const targetCell = localCells.get(`${x},${y}`);
        const changedCells = [];
        const processQueue = [];
        const processed = new Set();
        // Check if cell already owned
        if (targetCell === playerColour) {
            return { success: false, error: 'Cell already owned by you' };
        }
        // Flipping opponent cells requires 5+ neighbors
        if (targetCell !== undefined && targetCell !== null) {
            const neighbors8 = this.get8Neighbors(x, y);
            let playerNeighborCount = 0;
            for (const n of neighbors8) {
                const neighborOwner = localCells.get(`${n.x},${n.y}`);
                if (neighborOwner === playerColour) {
                    playerNeighborCount++;
                }
            }
            if (playerNeighborCount < 5) {
                return { success: false, error: 'Need 5+ neighbors to flip opponent cell' };
            }
        }
        // Place the initial cell
        localCells.set(`${x},${y}`, playerColour);
        changedCells.push({ x, y, owner: playerColour });
        // Queue neighbors for processing
        this.get8Neighbors(x, y).forEach(n => {
            processQueue.push(n);
        });
        // Process neighbor-based expansions
        while (processQueue.length > 0) {
            const current = processQueue.shift();
            const key = `${current.x},${current.y}`;
            if (processed.has(key))
                continue;
            processed.add(key);
            const currentOwner = localCells.get(key);
            let shouldFlip = false;
            let newOwner = currentOwner;
            if (currentOwner === undefined || currentOwner === null) {
                // Empty cell - check for 3+ same neighbors
                const neighbors4 = this.get4Neighbors(current.x, current.y);
                const ownerCounts = new Map();
                for (const n of neighbors4) {
                    const owner = localCells.get(`${n.x},${n.y}`);
                    if (owner !== undefined && owner !== null) {
                        ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
                    }
                }
                for (const [owner, count] of ownerCounts) {
                    if (count >= 3) {
                        shouldFlip = true;
                        newOwner = owner;
                        break;
                    }
                }
            }
            else if (currentOwner !== playerColour) {
                // Opponent cell - check for 5+ same neighbors
                const neighbors8 = this.get8Neighbors(current.x, current.y);
                const ownerCounts = new Map();
                for (const n of neighbors8) {
                    const owner = localCells.get(`${n.x},${n.y}`);
                    if (owner !== undefined && owner !== null) {
                        ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
                    }
                }
                for (const [owner, count] of ownerCounts) {
                    if (count >= 5 && owner !== currentOwner) {
                        shouldFlip = true;
                        newOwner = owner;
                        break;
                    }
                }
            }
            if (shouldFlip && newOwner !== currentOwner) {
                localCells.set(key, newOwner || null);
                changedCells.push({ x: current.x, y: current.y, owner: newOwner || null });
                // Queue neighbors of flipped cell
                this.get8Neighbors(current.x, current.y).forEach(n => {
                    const nKey = `${n.x},${n.y}`;
                    if (!processed.has(nKey)) {
                        processQueue.push(n);
                    }
                });
            }
        }
        // Check for enclosed areas after neighbor-based expansion
        const enclosedCells = this.findEnclosedAreas(localCells, playerColour, boundingBox);
        // Add enclosed cells to changes
        enclosedCells.forEach(enclosedCell => {
            const key = `${enclosedCell.x},${enclosedCell.y}`;
            localCells.set(key, enclosedCell.owner || null);
            changedCells.push({
                x: enclosedCell.x,
                y: enclosedCell.y,
                owner: enclosedCell.owner || null,
                data: { ...enclosedCell.data, wasEnclosed: true }
            });
        });
        // Persist changes
        await this.saveCells(changedCells);
        await this.updateScores(changedCells);
        return {
            success: true,
            changedCells,
            affectedChunks: this.getAffectedChunks(changedCells)
        };
    }
    async calculateScore() {
        // Implementation would query database for actual scores
        return { scores: new Map(), totalCells: 0 };
    }
    async checkWinCondition() {
        // Territory games typically don't have automatic win conditions
        return { hasWinner: false };
    }
    async getGameState() {
        const scores = await this.calculateScore();
        return {
            gameId: this.gameId,
            scores: scores.scores,
            totalCells: scores.totalCells || 0
        };
    }
    /**
     * Update scores based on cell changes
     */
    async updateScores(changedCells) {
        const colorCounts = new Map();
        changedCells.forEach(cell => {
            if (cell.owner !== null && cell.owner !== undefined) {
                colorCounts.set(cell.owner, (colorCounts.get(cell.owner) || 0) + 1);
            }
        });
        // Implementation would update database scores
    }
    // Abstract method implementations
    async loadCells(_bounds) {
        // Implementation would load from database
        return [];
    }
    async saveCells(_cells) {
        // Implementation would save to database
    }
}
exports.TerritoryEngine = TerritoryEngine;
/**
 * Territory-specific move validator
 */
class TerritoryMoveValidator {
    async validate(_playerId, moveData, _gameState) {
        // Basic validation
        if (typeof moveData.x !== 'number' || typeof moveData.y !== 'number') {
            return { isValid: false, error: 'Invalid coordinates' };
        }
        return { isValid: true };
    }
}
//# sourceMappingURL=TerritoryEngine.js.map