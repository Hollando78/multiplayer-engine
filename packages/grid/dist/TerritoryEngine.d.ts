import { BaseResourceManager, ResourceConfig } from '@multiplayer-engine/core';
import { GridGameEngine, GridGameRules, GridMoveResult, GridCell, GridOptions } from './GridGameEngine';
/**
 * TerritoryEngine - Reference implementation of the Territory Conquest game
 * Shows how to use the GridGameEngine for sophisticated territory mechanics
 */
export interface TerritoryGameState {
    gameId: string;
    scores: Map<string, number>;
    totalCells: number;
    lastMove?: {
        playerId: string;
        x: number;
        y: number;
        timestamp: Date;
    };
}
export interface TerritoryRules extends GridGameRules {
    resources: ResourceConfig;
    gridOptions: TerritoryGridOptions;
}
export interface TerritoryGridOptions extends GridOptions {
    infinite: true;
    chunkSize: number;
    maxBoundingBox: number;
}
/**
 * Territory Conquest game engine implementation
 */
export declare class TerritoryEngine extends GridGameEngine<TerritoryGameState, TerritoryRules> {
    constructor(gameId: string);
    protected createResourceManager(): BaseResourceManager;
    protected createMoveValidator(): TerritoryMoveValidator;
    /**
     * Territory-specific placement validation
     */
    canPlaceAt(x: number, y: number, playerId: string, isFirstMove?: boolean): Promise<boolean>;
    /**
     * Diagonal tunneling mechanic from Territory game
     */
    private canTunnelDiagonally;
    /**
     * Apply territory move with all the sophisticated mechanics
     */
    applyGridMove(x: number, y: number, playerColour: string): Promise<GridMoveResult>;
    calculateScore(): Promise<{
        scores: Map<string, number>;
        totalCells?: number;
    }>;
    checkWinCondition(): Promise<{
        hasWinner: boolean;
        winner?: string;
        reason?: string;
    }>;
    getGameState(): Promise<TerritoryGameState>;
    /**
     * Update scores based on cell changes
     */
    private updateScores;
    protected loadCells(_bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    }): Promise<GridCell[]>;
    protected saveCells(_cells: GridCell[]): Promise<void>;
}
/**
 * Territory-specific move validator
 */
declare class TerritoryMoveValidator {
    validate(_playerId: string, moveData: any, _gameState: any): Promise<import('@multiplayer-engine/core').ValidationResult>;
}
export {};
//# sourceMappingURL=TerritoryEngine.d.ts.map