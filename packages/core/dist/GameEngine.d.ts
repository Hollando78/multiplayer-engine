/**
 * Base abstract class for all multiplayer game engines.
 * Provides common patterns for move validation, state management, and resource handling.
 */
export declare abstract class GameEngine<TGameState = any, TMoveData = any, TGameRules = any> {
    protected gameId: string;
    protected rules: TGameRules;
    protected state: TGameState | undefined;
    protected resourceManager: BaseResourceManager;
    protected validator: MoveValidator<TMoveData>;
    constructor(gameId: string, rules: TGameRules);
    /**
     * Abstract methods that each game must implement
     */
    abstract validateMove(playerId: string, moveData: TMoveData): Promise<boolean>;
    abstract applyMove(playerId: string, moveData: TMoveData): Promise<MoveResult>;
    abstract calculateScore(): Promise<ScoreResult>;
    abstract checkWinCondition(): Promise<WinResult>;
    abstract getGameState(): Promise<TGameState>;
    /**
     * Abstract configuration methods
     */
    protected abstract createResourceManager(): BaseResourceManager;
    protected abstract createMoveValidator(): MoveValidator<TMoveData>;
    /**
     * Universal move processing pipeline
     * This is the main entry point for all game moves
     */
    makeMove(playerId: string, moveData: TMoveData): Promise<MoveResult>;
    /**
     * Get current game state for synchronization
     */
    getFullGameState(): Promise<GameStateSnapshot<TGameState>>;
}
/**
 * Base class for resource management - will be implemented by concrete ResourceManager
 */
export declare abstract class BaseResourceManager {
    protected config: ResourceConfig;
    constructor(config: ResourceConfig);
    abstract canSpend(playerId: string): Promise<boolean>;
    abstract spendResource(playerId: string): Promise<any>;
}
/**
 * Base class for move validation
 */
export declare abstract class MoveValidator<TMoveData = any> {
    abstract validate(playerId: string, moveData: TMoveData, gameState: any): Promise<ValidationResult>;
}
/**
 * Type definitions for the core engine
 */
export interface ResourceConfig {
    max: number;
    regenSeconds: number;
    starting: number;
}
export interface PlayerResources {
    current: number;
    lastRegenAt: Date;
    lastSpent: Date;
}
export interface MoveResult {
    success: boolean;
    error?: string;
    changedCells?: CellChange[];
    affectedChunks?: string[];
    winResult?: WinResult;
}
export interface CellChange {
    x: number;
    y: number;
    ownerColour?: string | null;
    [key: string]: any;
}
export interface ScoreResult {
    scores: Map<string, number>;
    totalCells?: number;
}
export interface WinResult {
    hasWinner: boolean;
    winner?: string;
    reason?: string;
}
export interface ValidationResult {
    isValid: boolean;
    error?: string;
}
export interface GameStateSnapshot<T = any> {
    gameId: string;
    state: T;
    scores: ScoreResult;
    rules: any;
    lastUpdated: Date;
}
//# sourceMappingURL=GameEngine.d.ts.map