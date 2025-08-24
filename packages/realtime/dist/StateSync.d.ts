/**
 * Universal state synchronization system with optimistic updates and conflict resolution
 * Extracted from Territory Conquest's real-time multiplayer synchronization
 */
import { GameStateUpdate } from '@multiplayer-engine/core';
import { PubSubManager } from './PubSubManager';
import { SocketManager } from './SocketManager';
export interface OptimisticUpdate<T = any> {
    id: string;
    gameId: string;
    playerId: string;
    type: string;
    data: T;
    timestamp: Date;
    acknowledged: boolean;
    rollbackData?: T;
}
export interface StateConflict<T = any> {
    updateId: string;
    serverState: T;
    clientState: T;
    conflictType: 'overwrite' | 'merge' | 'reject';
    resolution?: T;
}
export interface SyncConfig {
    maxPendingUpdates: number;
    acknowledgmentTimeout: number;
    conflictResolutionStrategy: 'server-wins' | 'client-wins' | 'merge' | 'custom';
    enableOptimisticUpdates: boolean;
}
/**
 * Manages real-time state synchronization with optimistic updates
 */
export declare class StateSync<TGameState = any> {
    private pubSubManager;
    private socketManager;
    private config;
    private gameStates;
    private pendingUpdates;
    private acknowledgmentTimers;
    private stateUpdateHandlers;
    constructor(pubSubManager: PubSubManager, socketManager: SocketManager, config?: Partial<SyncConfig>);
    /**
     * Apply an optimistic update immediately, then sync with server
     */
    applyOptimisticUpdate<T>(gameId: string, playerId: string, updateType: string, updateData: T, rollbackData?: T): Promise<string>;
    /**
     * Apply a server-authoritative state update
     */
    applyServerUpdate(gameId: string, update: GameStateUpdate<TGameState>): Promise<void>;
    /**
     * Acknowledge an optimistic update
     */
    acknowledgeUpdate(gameId: string, updateId: string, serverState?: TGameState): Promise<void>;
    /**
     * Register a handler for state updates
     */
    onStateUpdate(gameId: string, handler: StateUpdateHandler<TGameState>): void;
    /**
     * Get current game state
     */
    getGameState(gameId: string): TGameState | null;
    /**
     * Set initial game state
     */
    setGameState(gameId: string, state: TGameState): void;
    /**
     * Get pending updates for a game
     */
    getPendingUpdates(gameId: string): OptimisticUpdate[];
    /**
     * Force rollback of all pending updates for a game
     */
    rollbackPendingUpdates(gameId: string): Promise<void>;
    private setupSynchronization;
    private handleGameMessage;
    private handleMoveUpdate;
    private detectConflicts;
    private updatesConflict;
    private resolveConflicts;
    private resolveStateConflict;
    private mergeStates;
    private mergeUpdate;
    private compareStates;
    private applyUpdateToState;
    private applyRollback;
    private addPendingUpdate;
    private setAcknowledgmentTimeout;
    private generateUpdateId;
    private notifyStateUpdateHandlers;
    /**
     * Clean up resources for a game
     */
    cleanupGame(gameId: string): void;
    /**
     * Shutdown the state synchronization system
     */
    shutdown(): void;
}
/**
 * State update handler type
 */
export type StateUpdateHandler<T> = (gameId: string, newState: T, update: GameStateUpdate) => Promise<void> | void;
//# sourceMappingURL=StateSync.d.ts.map