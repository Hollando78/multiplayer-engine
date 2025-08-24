"use strict";
/**
 * Conway's Game of Life implementation using the multiplayer game engine
 * Demonstrates real-time synchronization with infinite grid and chunk-based updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConwayEngine = void 0;
const core_1 = require("@multiplayer-engine/core");
const grid_1 = require("@multiplayer-engine/grid");
/**
 * Conway's Game of Life multiplayer engine with real-time synchronization
 */
class ConwayEngine extends grid_1.GridGameEngine {
    gameState;
    simulationTimer = null;
    liveCells = new Map(); // "x,y" -> cell
    constructor(gameId) {
        const rules = {
            gridOptions: {
                infinite: true,
                chunkSize: 64,
                maxBoundingBox: 100 // Larger search area for Conway's patterns
            },
            resources: {
                max: 10, // Players can place 10 cells
                regenSeconds: 5, // Fast regeneration for interactive placement
                starting: 10
            },
            gameOptions: {
                autoRun: true,
                generationInterval: 500, // 500ms per generation
                maxGenerations: 1000 // Stop after 1000 generations to prevent infinite runs
            }
        };
        super(gameId, rules);
        this.gameState = {
            gameId,
            generation: 0,
            isRunning: false,
            speed: rules.gameOptions.generationInterval,
            aliveCells: 0,
            totalGenerations: 0,
            players: new Map()
        };
    }
    createResourceManager() {
        return new core_1.InMemoryResourceManager(this.rules.resources);
    }
    createMoveValidator() {
        return new ConwayMoveValidator();
    }
    /**
     * Conway's Life allows placing cells anywhere
     */
    async canPlaceAt(x, y, playerId) {
        const cellKey = `${x},${y}`;
        // Can't place on existing live cells
        if (this.liveCells.has(cellKey)) {
            return false;
        }
        // Must have resources
        const hasResources = await this.resourceManager.canSpend(playerId);
        return hasResources;
    }
    /**
     * Place a cell and start the simulation if not running
     */
    async applyGridMove(x, y, playerId) {
        const cellKey = `${x},${y}`;
        // Create new cell
        const newCell = {
            x,
            y,
            alive: true,
            playerId,
            generation: this.gameState.generation
        };
        this.liveCells.set(cellKey, newCell);
        this.gameState.aliveCells++;
        // Update player stats
        let player = this.gameState.players.get(playerId);
        if (!player) {
            player = {
                playerId,
                color: this.generatePlayerColor(playerId),
                cellsPlaced: 0,
                isObserver: false
            };
            this.gameState.players.set(playerId, player);
        }
        player.cellsPlaced++;
        const changedCells = [{
                x,
                y,
                owner: playerId,
                data: { alive: true, generation: this.gameState.generation }
            }];
        // Start simulation if not running and we have cells
        if (!this.gameState.isRunning && this.gameState.aliveCells > 0) {
            this.startSimulation();
        }
        return {
            success: true,
            changedCells,
            affectedChunks: this.getAffectedChunks(changedCells)
        };
    }
    /**
     * Start the Conway's Life simulation
     */
    startSimulation() {
        if (this.gameState.isRunning)
            return;
        this.gameState.isRunning = true;
        console.log(`Starting Conway's Life simulation for game ${this.gameId}`);
        this.simulationTimer = setInterval(() => {
            this.runGeneration();
        }, this.gameState.speed);
    }
    /**
     * Stop the simulation
     */
    stopSimulation() {
        if (!this.gameState.isRunning)
            return;
        this.gameState.isRunning = false;
        if (this.simulationTimer) {
            clearInterval(this.simulationTimer);
            this.simulationTimer = null;
        }
        console.log(`Stopped Conway's Life simulation for game ${this.gameId}`);
    }
    /**
     * Run one generation of Conway's Life
     */
    async runGeneration() {
        const newGeneration = this.gameState.generation + 1;
        const newLiveCells = new Map();
        const changedCells = [];
        // Get all cells that need to be checked (live cells + their neighbors)
        const cellsToCheck = this.getCellsToCheck();
        for (const [x, y] of cellsToCheck) {
            const cellKey = `${x},${y}`;
            const currentCell = this.liveCells.get(cellKey);
            const isCurrentlyAlive = currentCell !== undefined;
            const liveNeighbors = this.countLiveNeighbors(x, y);
            let shouldLive = false;
            // Conway's Rules:
            // 1. Live cell with 2-3 neighbors survives
            // 2. Dead cell with exactly 3 neighbors becomes alive
            if (isCurrentlyAlive) {
                shouldLive = liveNeighbors === 2 || liveNeighbors === 3;
            }
            else {
                shouldLive = liveNeighbors === 3;
            }
            if (shouldLive) {
                const newCell = {
                    x,
                    y,
                    alive: true,
                    playerId: currentCell?.playerId, // Inherit original placer
                    generation: newGeneration
                };
                newLiveCells.set(cellKey, newCell);
                // Track changes
                if (!isCurrentlyAlive) {
                    changedCells.push({
                        x,
                        y,
                        owner: newCell.playerId || null,
                        data: { alive: true, generation: newGeneration, born: true }
                    });
                }
            }
            else if (isCurrentlyAlive) {
                // Cell died
                changedCells.push({
                    x,
                    y,
                    owner: null,
                    data: { alive: false, generation: newGeneration, died: true }
                });
            }
        }
        // Update state
        this.liveCells = newLiveCells;
        this.gameState.generation = newGeneration;
        this.gameState.aliveCells = newLiveCells.size;
        this.gameState.totalGenerations++;
        // Persist changes for real-time synchronization
        if (changedCells.length > 0) {
            await this.saveCells(changedCells);
        }
        console.log(`Generation ${newGeneration}: ${this.gameState.aliveCells} alive cells, ${changedCells.length} changes`);
        // Stop if no live cells or max generations reached
        if (this.gameState.aliveCells === 0) {
            console.log('No live cells remaining, stopping simulation');
            this.stopSimulation();
        }
        else if (this.rules.gameOptions.maxGenerations &&
            this.gameState.generation >= this.rules.gameOptions.maxGenerations) {
            console.log('Max generations reached, stopping simulation');
            this.stopSimulation();
        }
    }
    /**
     * Get all cells that need to be checked for the next generation
     */
    getCellsToCheck() {
        const cellsToCheck = new Set();
        // Add all live cells and their neighbors
        for (const cell of this.liveCells.values()) {
            const neighbors = this.get8Neighbors(cell.x, cell.y);
            // Add the cell itself
            cellsToCheck.add([cell.x, cell.y]);
            // Add all neighbors
            for (const neighbor of neighbors) {
                cellsToCheck.add([neighbor.x, neighbor.y]);
            }
        }
        return cellsToCheck;
    }
    /**
     * Count live neighbors for a cell
     */
    countLiveNeighbors(x, y) {
        const neighbors = this.get8Neighbors(x, y);
        let count = 0;
        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.x},${neighbor.y}`;
            if (this.liveCells.has(neighborKey)) {
                count++;
            }
        }
        return count;
    }
    /**
     * Generate a color for a player
     */
    generatePlayerColor(playerId) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        const hash = playerId.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        return colors[Math.abs(hash) % colors.length];
    }
    async calculateScore() {
        const scores = new Map();
        // Score based on cells currently alive that they originally placed
        for (const cell of this.liveCells.values()) {
            if (cell.playerId) {
                scores.set(cell.playerId, (scores.get(cell.playerId) || 0) + 1);
            }
        }
        return { scores, totalCells: this.gameState.aliveCells };
    }
    async checkWinCondition() {
        // Conway's Life doesn't have traditional win conditions
        // We could define custom ones like "most surviving cells" or "longest-lived pattern"
        if (this.gameState.aliveCells === 0) {
            return {
                hasWinner: true,
                winner: 'entropy',
                reason: 'All life has ended'
            };
        }
        return { hasWinner: false };
    }
    async getGameState() {
        return { ...this.gameState };
    }
    /**
     * Get current live cells for synchronization
     */
    getLiveCells() {
        return Array.from(this.liveCells.values());
    }
    /**
     * Set simulation speed
     */
    setSpeed(speed) {
        this.gameState.speed = Math.max(100, Math.min(5000, speed)); // 100ms to 5s
        if (this.gameState.isRunning) {
            this.stopSimulation();
            this.startSimulation();
        }
    }
    /**
     * Load common Conway's Life patterns
     */
    loadPattern(patternName, originX, originY, playerId) {
        const patterns = {
            'glider': [
                [0, 1], [1, 2], [2, 0], [2, 1], [2, 2]
            ],
            'blinker': [
                [0, 0], [0, 1], [0, 2]
            ],
            'block': [
                [0, 0], [0, 1], [1, 0], [1, 1]
            ],
            'beehive': [
                [1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]
            ]
        };
        const pattern = patterns[patternName];
        if (!pattern) {
            return { success: false, error: `Unknown pattern: ${patternName}` };
        }
        const changedCells = [];
        for (const [dx, dy] of pattern) {
            const x = originX + dx;
            const y = originY + dy;
            const cellKey = `${x},${y}`;
            if (!this.liveCells.has(cellKey)) {
                const cell = {
                    x,
                    y,
                    alive: true,
                    playerId,
                    generation: this.gameState.generation
                };
                this.liveCells.set(cellKey, cell);
                changedCells.push({
                    x,
                    y,
                    owner: playerId,
                    data: { alive: true, generation: this.gameState.generation, pattern: patternName }
                });
            }
        }
        this.gameState.aliveCells += changedCells.length;
        // Update player stats
        const player = this.gameState.players.get(playerId);
        if (player) {
            player.cellsPlaced += changedCells.length;
        }
        return {
            success: true,
            changedCells,
            affectedChunks: this.getAffectedChunks(changedCells)
        };
    }
    // Abstract method implementations (simplified for demo)
    async loadCells(_bounds) {
        // In a real implementation, this would load from persistent storage
        return Array.from(this.liveCells.values()).map(cell => ({
            x: cell.x,
            y: cell.y,
            owner: cell.playerId || null,
            data: { alive: cell.alive, generation: cell.generation }
        }));
    }
    async saveCells(_cells) {
        // In a real implementation, this would save to persistent storage
        // For now, changes are already applied to this.liveCells
    }
    /**
     * Cleanup when shutting down
     */
    shutdown() {
        this.stopSimulation();
        console.log(`ConwayEngine for game ${this.gameId} shut down`);
    }
}
exports.ConwayEngine = ConwayEngine;
/**
 * Conway-specific move validator
 */
class ConwayMoveValidator {
    async validate(_playerId, moveData) {
        // Basic validation for Conway's Life moves
        if (typeof moveData.x !== 'number' || typeof moveData.y !== 'number') {
            return { isValid: false, error: 'Invalid coordinates' };
        }
        // Coordinate bounds (prevent infinite expansion)
        if (Math.abs(moveData.x) > 1000 || Math.abs(moveData.y) > 1000) {
            return { isValid: false, error: 'Coordinates too far from origin' };
        }
        return { isValid: true };
    }
}
//# sourceMappingURL=ConwayEngine.js.map