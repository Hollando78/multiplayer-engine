/**
 * Conway's Game of Life implementation using the multiplayer game engine
 * Demonstrates real-time synchronization with infinite grid and chunk-based updates
 */
import { BaseResourceManager } from '@multiplayer-engine/core';
import { GridGameEngine, GridGameRules, GridMoveResult, GridCell } from '@multiplayer-engine/grid';
export interface ConwayGameState {
    gameId: string;
    generation: number;
    isRunning: boolean;
    speed: number;
    aliveCells: number;
    totalGenerations: number;
    players: Map<string, ConwayPlayer>;
}
export interface ConwayPlayer {
    playerId: string;
    color: string;
    cellsPlaced: number;
    isObserver: boolean;
}
export interface ConwayRules extends GridGameRules {
    gridOptions: {
        infinite: true;
        chunkSize: number;
        maxBoundingBox: number;
    };
    resources: {
        max: number;
        regenSeconds: number;
        starting: number;
    };
    gameOptions: {
        autoRun: boolean;
        generationInterval: number;
        maxGenerations?: number;
    };
}
export interface ConwayCell {
    x: number;
    y: number;
    alive: boolean;
    playerId?: string;
    generation: number;
}
/**
 * Conway's Game of Life multiplayer engine with real-time synchronization
 */
export declare class ConwayEngine extends GridGameEngine<ConwayGameState, ConwayRules> {
    private gameState;
    private simulationTimer;
    private liveCells;
    constructor(gameId: string);
    protected createResourceManager(): BaseResourceManager;
    protected createMoveValidator(): ConwayMoveValidator;
    /**
     * Conway's Life allows placing cells anywhere
     */
    canPlaceAt(x: number, y: number, playerId: string): Promise<boolean>;
    /**
     * Place a cell and start the simulation if not running
     */
    applyGridMove(x: number, y: number, playerId: string): Promise<GridMoveResult>;
    /**
     * Start the Conway's Life simulation
     */
    startSimulation(): void;
    /**
     * Stop the simulation
     */
    stopSimulation(): void;
    /**
     * Run one generation of Conway's Life
     */
    private runGeneration;
    /**
     * Get all cells that need to be checked for the next generation
     */
    private getCellsToCheck;
    /**
     * Count live neighbors for a cell
     */
    private countLiveNeighbors;
    /**
     * Generate a color for a player
     */
    private generatePlayerColor;
    calculateScore(): Promise<{
        scores: Map<string, number>;
        totalCells?: number;
    }>;
    checkWinCondition(): Promise<{
        hasWinner: boolean;
        winner?: string;
        reason?: string;
    }>;
    getGameState(): Promise<ConwayGameState>;
    /**
     * Get current live cells for synchronization
     */
    getLiveCells(): ConwayCell[];
    /**
     * Set simulation speed
     */
    setSpeed(speed: number): void;
    /**
     * Load common Conway's Life patterns
     */
    loadPattern(patternName: string, originX: number, originY: number, playerId: string): GridMoveResult;
    protected loadCells(_bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    }): Promise<GridCell[]>;
    protected saveCells(_cells: GridCell[]): Promise<void>;
    /**
     * Cleanup when shutting down
     */
    shutdown(): void;
}
/**
 * Conway-specific move validator
 */
declare class ConwayMoveValidator {
    validate(_playerId: string, moveData: any): Promise<import('@multiplayer-engine/core').ValidationResult>;
}
export {};
