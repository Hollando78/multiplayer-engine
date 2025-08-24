/**
 * Universal state synchronization system with optimistic updates and conflict resolution
 * Extracted from Territory Conquest's real-time multiplayer synchronization
 */

import { GameStateUpdate } from '@multiplayer-engine/core';
import { PubSubManager, GameMessage } from './PubSubManager';
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
export class StateSync<TGameState = any> {
  private pubSubManager: PubSubManager;
  private socketManager: SocketManager;
  private config: SyncConfig;
  private gameStates: Map<string, TGameState> = new Map(); // gameId -> state
  private pendingUpdates: Map<string, OptimisticUpdate[]> = new Map(); // gameId -> updates
  private acknowledgmentTimers: Map<string, NodeJS.Timeout> = new Map(); // updateId -> timer
  private stateUpdateHandlers: Map<string, StateUpdateHandler<TGameState>[]> = new Map(); // gameId -> handlers

  constructor(
    pubSubManager: PubSubManager,
    socketManager: SocketManager,
    config: Partial<SyncConfig> = {}
  ) {
    this.pubSubManager = pubSubManager;
    this.socketManager = socketManager;
    this.config = {
      maxPendingUpdates: 100,
      acknowledgmentTimeout: 5000, // 5 seconds
      conflictResolutionStrategy: 'server-wins',
      enableOptimisticUpdates: true,
      ...config
    };

    this.setupSynchronization();
  }

  /**
   * Apply an optimistic update immediately, then sync with server
   */
  async applyOptimisticUpdate<T>(
    gameId: string,
    playerId: string,
    updateType: string,
    updateData: T,
    rollbackData?: T
  ): Promise<string> {
    const updateId = this.generateUpdateId();
    
    const update: OptimisticUpdate<T> = {
      id: updateId,
      gameId,
      playerId,
      type: updateType,
      data: updateData,
      timestamp: new Date(),
      acknowledged: false,
      rollbackData
    };

    if (this.config.enableOptimisticUpdates) {
      // Apply update locally first
      await this.applyUpdateToState(gameId, update);
      
      // Track pending update
      this.addPendingUpdate(gameId, update);
      
      // Set acknowledgment timeout
      this.setAcknowledgmentTimeout(updateId);
    }

    // Send to server for authoritative processing
    await this.pubSubManager.publishGameUpdate(gameId, {
      type: 'state-change',
      playerId,
      data: {
        updateId,
        type: updateType,
        data: updateData,
        optimistic: true
      }
    });

    return updateId;
  }

  /**
   * Apply a server-authoritative state update
   */
  async applyServerUpdate(gameId: string, update: GameStateUpdate<TGameState>): Promise<void> {
    const currentState = this.gameStates.get(gameId);
    
    if (!currentState) {
      console.warn(`No current state found for game ${gameId}`);
      return;
    }

    // Check for conflicts with pending optimistic updates
    const conflicts = this.detectConflicts(gameId, update);
    
    if (conflicts.length > 0) {
      await this.resolveConflicts(gameId, conflicts);
    }

    // Apply server update
    const newState = await this.mergeUpdate(currentState, update);
    this.gameStates.set(gameId, newState);

    // Notify handlers
    await this.notifyStateUpdateHandlers(gameId, newState, update);

    // Broadcast to clients
    this.socketManager.broadcastToGame(gameId, 'state-updated', {
      gameId,
      state: newState,
      update,
      timestamp: new Date()
    });
  }

  /**
   * Acknowledge an optimistic update
   */
  async acknowledgeUpdate(gameId: string, updateId: string, serverState?: TGameState): Promise<void> {
    const pendingUpdates = this.pendingUpdates.get(gameId) || [];
    const updateIndex = pendingUpdates.findIndex(u => u.id === updateId);
    
    if (updateIndex === -1) {
      console.warn(`Update ${updateId} not found in pending updates for game ${gameId}`);
      return;
    }

    const update = pendingUpdates[updateIndex];
    update.acknowledged = true;

    // Clear timeout
    const timer = this.acknowledgmentTimers.get(updateId);
    if (timer) {
      clearTimeout(timer);
      this.acknowledgmentTimers.delete(updateId);
    }

    // If server provided authoritative state, apply it
    if (serverState) {
      const conflict = this.compareStates(this.gameStates.get(gameId)!, serverState);
      if (conflict) {
        await this.resolveStateConflict(gameId, {
          updateId,
          serverState,
          clientState: this.gameStates.get(gameId)!,
          conflictType: 'overwrite'
        });
      }
    }

    // Remove acknowledged update
    pendingUpdates.splice(updateIndex, 1);

    console.log(`Acknowledged optimistic update ${updateId} for game ${gameId}`);
  }

  /**
   * Register a handler for state updates
   */
  onStateUpdate(gameId: string, handler: StateUpdateHandler<TGameState>): void {
    if (!this.stateUpdateHandlers.has(gameId)) {
      this.stateUpdateHandlers.set(gameId, []);
    }
    
    this.stateUpdateHandlers.get(gameId)!.push(handler);
  }

  /**
   * Get current game state
   */
  getGameState(gameId: string): TGameState | null {
    return this.gameStates.get(gameId) || null;
  }

  /**
   * Set initial game state
   */
  setGameState(gameId: string, state: TGameState): void {
    this.gameStates.set(gameId, state);
  }

  /**
   * Get pending updates for a game
   */
  getPendingUpdates(gameId: string): OptimisticUpdate[] {
    return this.pendingUpdates.get(gameId) || [];
  }

  /**
   * Force rollback of all pending updates for a game
   */
  async rollbackPendingUpdates(gameId: string): Promise<void> {
    const pendingUpdates = this.pendingUpdates.get(gameId) || [];
    
    // Apply rollback data in reverse order
    for (let i = pendingUpdates.length - 1; i >= 0; i--) {
      const update = pendingUpdates[i];
      if (update.rollbackData) {
        await this.applyRollback(gameId, update);
      }
    }

    // Clear pending updates
    this.pendingUpdates.set(gameId, []);

    // Clear timers
    pendingUpdates.forEach(update => {
      const timer = this.acknowledgmentTimers.get(update.id);
      if (timer) {
        clearTimeout(timer);
        this.acknowledgmentTimers.delete(update.id);
      }
    });

    console.log(`Rolled back ${pendingUpdates.length} pending updates for game ${gameId}`);
  }

  private setupSynchronization(): void {
    // Subscribe to all game updates
    this.pubSubManager.subscribeToAllGames((channel, message) => {
      this.handleGameMessage(message);
    });
  }

  private async handleGameMessage(message: GameMessage): Promise<void> {
    const { gameId, type, data } = message;

    switch (type) {
      case 'state-change':
        if (data.optimistic && data.updateId) {
          // This is an acknowledgment of our optimistic update
          await this.acknowledgeUpdate(gameId, data.updateId, data.serverState);
        } else {
          // This is a server-authoritative update
          await this.applyServerUpdate(gameId, {
            gameId,
            updates: data,
            timestamp: message.timestamp,
            playerId: message.playerId
          });
        }
        break;
        
      case 'move':
        // Handle move updates (which affect state)
        await this.handleMoveUpdate(gameId, data);
        break;
    }
  }

  private async handleMoveUpdate(gameId: string, moveData: any): Promise<void> {
    // Apply move to current state
    const currentState = this.gameStates.get(gameId);
    if (currentState) {
      // This would be game-specific logic
      // For now, just notify handlers
      await this.notifyStateUpdateHandlers(gameId, currentState, {
        gameId,
        updates: { move: moveData },
        timestamp: new Date(),
        playerId: undefined
      });
    }
  }

  private detectConflicts(gameId: string, serverUpdate: GameStateUpdate): StateConflict[] {
    const pendingUpdates = this.pendingUpdates.get(gameId) || [];
    const conflicts: StateConflict[] = [];

    // Simple conflict detection - check if server update affects same properties
    // In a real implementation, this would be more sophisticated
    for (const pending of pendingUpdates.filter(u => !u.acknowledged)) {
      if (this.updatesConflict(pending, serverUpdate)) {
        conflicts.push({
          updateId: pending.id,
          serverState: serverUpdate.updates as any,
          clientState: pending.data as any,
          conflictType: 'overwrite'
        });
      }
    }

    return conflicts;
  }

  private updatesConflict(optimistic: OptimisticUpdate, server: GameStateUpdate): boolean {
    // Basic conflict detection - this would be game-specific
    // For now, assume any updates from different sources conflict
    return optimistic.playerId !== server.playerId;
  }

  private async resolveConflicts(gameId: string, conflicts: StateConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      await this.resolveStateConflict(gameId, conflict);
    }
  }

  private async resolveStateConflict(gameId: string, conflict: StateConflict): Promise<void> {
    let resolution: any;

    switch (this.config.conflictResolutionStrategy) {
      case 'server-wins':
        resolution = conflict.serverState;
        break;
      case 'client-wins':
        resolution = conflict.clientState;
        break;
      case 'merge':
        resolution = this.mergeStates(conflict.serverState, conflict.clientState);
        break;
      default:
        resolution = conflict.serverState;
    }

    conflict.resolution = resolution;

    // Apply resolution
    const currentState = this.gameStates.get(gameId);
    if (currentState) {
      const resolvedState = await this.mergeUpdate(currentState, {
        gameId,
        updates: resolution,
        timestamp: new Date(),
        playerId: undefined
      });
      this.gameStates.set(gameId, resolvedState);
    }

    console.log(`Resolved conflict for update ${conflict.updateId} using ${this.config.conflictResolutionStrategy}`);
  }

  private mergeStates(serverState: any, clientState: any): any {
    // Simple merge strategy - server state takes precedence
    // In a real implementation, this would be much more sophisticated
    return { ...clientState, ...serverState };
  }

  private async mergeUpdate(state: TGameState, update: GameStateUpdate): Promise<TGameState> {
    // Simple merge - in a real implementation, this would be game-specific
    return { ...state, ...update.updates } as TGameState;
  }

  private compareStates(state1: TGameState, state2: TGameState): boolean {
    // Simple comparison - in a real implementation, this would be more sophisticated
    return JSON.stringify(state1) !== JSON.stringify(state2);
  }

  private async applyUpdateToState(gameId: string, update: OptimisticUpdate): Promise<void> {
    const currentState = this.gameStates.get(gameId);
    if (currentState) {
      // This would be game-specific update logic
      const newState = { ...currentState, ...update.data } as TGameState;
      this.gameStates.set(gameId, newState);
    }
  }

  private async applyRollback(gameId: string, update: OptimisticUpdate): Promise<void> {
    if (update.rollbackData) {
      const currentState = this.gameStates.get(gameId);
      if (currentState) {
        const rolledBackState = { ...currentState, ...update.rollbackData } as TGameState;
        this.gameStates.set(gameId, rolledBackState);
      }
    }
  }

  private addPendingUpdate(gameId: string, update: OptimisticUpdate): void {
    if (!this.pendingUpdates.has(gameId)) {
      this.pendingUpdates.set(gameId, []);
    }

    const updates = this.pendingUpdates.get(gameId)!;
    updates.push(update);

    // Limit pending updates
    if (updates.length > this.config.maxPendingUpdates) {
      updates.shift(); // Remove oldest
    }
  }

  private setAcknowledgmentTimeout(updateId: string): void {
    const timer = setTimeout(() => {
      console.warn(`Optimistic update ${updateId} timed out waiting for acknowledgment`);
      this.acknowledgmentTimers.delete(updateId);
      // Could trigger rollback here
    }, this.config.acknowledgmentTimeout);

    this.acknowledgmentTimers.set(updateId, timer);
  }

  private generateUpdateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private async notifyStateUpdateHandlers(
    gameId: string,
    newState: TGameState,
    update: GameStateUpdate
  ): Promise<void> {
    const handlers = this.stateUpdateHandlers.get(gameId) || [];
    
    for (const handler of handlers) {
      try {
        await handler(gameId, newState, update);
      } catch (error) {
        console.error('Error in state update handler:', error);
      }
    }
  }

  /**
   * Clean up resources for a game
   */
  cleanupGame(gameId: string): void {
    // Clear state
    this.gameStates.delete(gameId);
    
    // Clear pending updates and timers
    const pendingUpdates = this.pendingUpdates.get(gameId) || [];
    pendingUpdates.forEach(update => {
      const timer = this.acknowledgmentTimers.get(update.id);
      if (timer) {
        clearTimeout(timer);
        this.acknowledgmentTimers.delete(update.id);
      }
    });
    this.pendingUpdates.delete(gameId);
    
    // Clear handlers
    this.stateUpdateHandlers.delete(gameId);

    console.log(`Cleaned up state sync for game ${gameId}`);
  }

  /**
   * Shutdown the state synchronization system
   */
  shutdown(): void {
    // Clear all timers
    for (const timer of this.acknowledgmentTimers.values()) {
      clearTimeout(timer);
    }

    // Clear all data
    this.gameStates.clear();
    this.pendingUpdates.clear();
    this.acknowledgmentTimers.clear();
    this.stateUpdateHandlers.clear();

    console.log('StateSync shut down gracefully');
  }
}

/**
 * State update handler type
 */
export type StateUpdateHandler<T> = (gameId: string, newState: T, update: GameStateUpdate) => Promise<void> | void;