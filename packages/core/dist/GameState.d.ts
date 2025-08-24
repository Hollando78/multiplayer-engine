/**
 * GameState - Central state management system for multiplayer games
 * Provides state tracking, transitions, and synchronization patterns
 */
export declare enum GameStatus {
    WAITING = "WAITING",
    ACTIVE = "ACTIVE",
    PAUSED = "PAUSED",
    FINISHED = "FINISHED"
}
export interface BaseGameState {
    gameId: string;
    status: GameStatus;
    createdAt: Date;
    updatedAt: Date;
    maxPlayers: number;
    currentPlayers: string[];
    winner?: string;
    metadata?: Record<string, any>;
}
export interface GameStateUpdate<T = any> {
    gameId: string;
    updates: Partial<T>;
    timestamp: Date;
    playerId?: string;
    reason?: string;
}
/**
 * Abstract base class for game state management
 */
export declare abstract class GameStateManager<T extends BaseGameState = BaseGameState> {
    protected gameId: string;
    protected currentState: T;
    protected subscribers: Set<StateSubscriber<T>>;
    constructor(gameId: string, initialState: T);
    /**
     * Get current game state
     */
    getState(): T;
    /**
     * Update game state with validation
     */
    updateState(updates: Partial<T>, playerId?: string, reason?: string): Promise<boolean>;
    /**
     * Handle game status transitions with validation
     */
    transitionStatus(newStatus: GameStatus, playerId?: string, reason?: string): Promise<boolean>;
    /**
     * Add a player to the game
     */
    addPlayer(playerId: string): Promise<boolean>;
    /**
     * Remove a player from the game
     */
    removePlayer(playerId: string): Promise<boolean>;
    /**
     * Subscribe to state changes
     */
    subscribe(subscriber: StateSubscriber<T>): void;
    /**
     * Unsubscribe from state changes
     */
    unsubscribe(subscriber: StateSubscriber<T>): void;
    /**
     * Notify all subscribers of state changes
     */
    protected notifySubscribers(newState: T, updateData: GameStateUpdate<T>): void;
    /**
     * Validate status transitions
     */
    protected isValidStatusTransition(from: GameStatus, to: GameStatus): boolean;
    protected abstract validateStateUpdate(updates: Partial<T>, currentState: T): Promise<ValidationResult>;
    protected abstract persistState(state: T): Promise<void>;
}
/**
 * In-memory GameStateManager for testing and simple games
 */
export declare class InMemoryGameStateManager<T extends BaseGameState> extends GameStateManager<T> {
    private stateHistory;
    protected validateStateUpdate(_updates: Partial<T>, _currentState: T): Promise<ValidationResult>;
    protected persistState(state: T): Promise<void>;
    /**
     * Get state history for testing/debugging
     */
    getStateHistory(): T[];
    /**
     * Clear state history
     */
    clearHistory(): void;
}
/**
 * State subscriber interface
 */
export interface StateSubscriber<T = any> {
    onStateUpdate(newState: T, updateData: GameStateUpdate<T>): void;
}
/**
 * Validation result interface
 */
export interface ValidationResult {
    isValid: boolean;
    error?: string;
}
/**
 * Utility functions for game state management
 */
export declare class GameStateUtils {
    /**
     * Create initial game state
     */
    static createInitialState<T extends BaseGameState>(gameId: string, maxPlayers: number, additionalProperties?: Omit<T, keyof BaseGameState>): T;
    /**
     * Check if game can accept new players
     */
    static canAcceptPlayer(state: BaseGameState): boolean;
    /**
     * Check if game is in progress
     */
    static isInProgress(state: BaseGameState): boolean;
    /**
     * Check if game is finished
     */
    static isFinished(state: BaseGameState): boolean;
}
//# sourceMappingURL=GameState.d.ts.map