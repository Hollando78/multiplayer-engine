"use strict";
/**
 * Universal state synchronization system with optimistic updates and conflict resolution
 * Extracted from Territory Conquest's real-time multiplayer synchronization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateSync = void 0;
/**
 * Manages real-time state synchronization with optimistic updates
 */
class StateSync {
    pubSubManager;
    socketManager;
    config;
    gameStates = new Map(); // gameId -> state
    pendingUpdates = new Map(); // gameId -> updates
    acknowledgmentTimers = new Map(); // updateId -> timer
    stateUpdateHandlers = new Map(); // gameId -> handlers
    constructor(pubSubManager, socketManager, config = {}) {
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
    async applyOptimisticUpdate(gameId, playerId, updateType, updateData, rollbackData) {
        const updateId = this.generateUpdateId();
        const update = {
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
    async applyServerUpdate(gameId, update) {
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
    async acknowledgeUpdate(gameId, updateId, serverState) {
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
            const conflict = this.compareStates(this.gameStates.get(gameId), serverState);
            if (conflict) {
                await this.resolveStateConflict(gameId, {
                    updateId,
                    serverState,
                    clientState: this.gameStates.get(gameId),
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
    onStateUpdate(gameId, handler) {
        if (!this.stateUpdateHandlers.has(gameId)) {
            this.stateUpdateHandlers.set(gameId, []);
        }
        this.stateUpdateHandlers.get(gameId).push(handler);
    }
    /**
     * Get current game state
     */
    getGameState(gameId) {
        return this.gameStates.get(gameId) || null;
    }
    /**
     * Set initial game state
     */
    setGameState(gameId, state) {
        this.gameStates.set(gameId, state);
    }
    /**
     * Get pending updates for a game
     */
    getPendingUpdates(gameId) {
        return this.pendingUpdates.get(gameId) || [];
    }
    /**
     * Force rollback of all pending updates for a game
     */
    async rollbackPendingUpdates(gameId) {
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
    setupSynchronization() {
        // Subscribe to all game updates
        this.pubSubManager.subscribeToAllGames((channel, message) => {
            this.handleGameMessage(message);
        });
    }
    async handleGameMessage(message) {
        const { gameId, type, data } = message;
        switch (type) {
            case 'state-change':
                if (data.optimistic && data.updateId) {
                    // This is an acknowledgment of our optimistic update
                    await this.acknowledgeUpdate(gameId, data.updateId, data.serverState);
                }
                else {
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
    async handleMoveUpdate(gameId, moveData) {
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
    detectConflicts(gameId, serverUpdate) {
        const pendingUpdates = this.pendingUpdates.get(gameId) || [];
        const conflicts = [];
        // Simple conflict detection - check if server update affects same properties
        // In a real implementation, this would be more sophisticated
        for (const pending of pendingUpdates.filter(u => !u.acknowledged)) {
            if (this.updatesConflict(pending, serverUpdate)) {
                conflicts.push({
                    updateId: pending.id,
                    serverState: serverUpdate.updates,
                    clientState: pending.data,
                    conflictType: 'overwrite'
                });
            }
        }
        return conflicts;
    }
    updatesConflict(optimistic, server) {
        // Basic conflict detection - this would be game-specific
        // For now, assume any updates from different sources conflict
        return optimistic.playerId !== server.playerId;
    }
    async resolveConflicts(gameId, conflicts) {
        for (const conflict of conflicts) {
            await this.resolveStateConflict(gameId, conflict);
        }
    }
    async resolveStateConflict(gameId, conflict) {
        let resolution;
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
    mergeStates(serverState, clientState) {
        // Simple merge strategy - server state takes precedence
        // In a real implementation, this would be much more sophisticated
        return { ...clientState, ...serverState };
    }
    async mergeUpdate(state, update) {
        // Simple merge - in a real implementation, this would be game-specific
        return { ...state, ...update.updates };
    }
    compareStates(state1, state2) {
        // Simple comparison - in a real implementation, this would be more sophisticated
        return JSON.stringify(state1) !== JSON.stringify(state2);
    }
    async applyUpdateToState(gameId, update) {
        const currentState = this.gameStates.get(gameId);
        if (currentState) {
            // This would be game-specific update logic
            const newState = { ...currentState, ...update.data };
            this.gameStates.set(gameId, newState);
        }
    }
    async applyRollback(gameId, update) {
        if (update.rollbackData) {
            const currentState = this.gameStates.get(gameId);
            if (currentState) {
                const rolledBackState = { ...currentState, ...update.rollbackData };
                this.gameStates.set(gameId, rolledBackState);
            }
        }
    }
    addPendingUpdate(gameId, update) {
        if (!this.pendingUpdates.has(gameId)) {
            this.pendingUpdates.set(gameId, []);
        }
        const updates = this.pendingUpdates.get(gameId);
        updates.push(update);
        // Limit pending updates
        if (updates.length > this.config.maxPendingUpdates) {
            updates.shift(); // Remove oldest
        }
    }
    setAcknowledgmentTimeout(updateId) {
        const timer = setTimeout(() => {
            console.warn(`Optimistic update ${updateId} timed out waiting for acknowledgment`);
            this.acknowledgmentTimers.delete(updateId);
            // Could trigger rollback here
        }, this.config.acknowledgmentTimeout);
        this.acknowledgmentTimers.set(updateId, timer);
    }
    generateUpdateId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    }
    async notifyStateUpdateHandlers(gameId, newState, update) {
        const handlers = this.stateUpdateHandlers.get(gameId) || [];
        for (const handler of handlers) {
            try {
                await handler(gameId, newState, update);
            }
            catch (error) {
                console.error('Error in state update handler:', error);
            }
        }
    }
    /**
     * Clean up resources for a game
     */
    cleanupGame(gameId) {
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
    shutdown() {
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
exports.StateSync = StateSync;
//# sourceMappingURL=StateSync.js.map