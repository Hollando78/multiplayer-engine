"use strict";
/**
 * GameState - Central state management system for multiplayer games
 * Provides state tracking, transitions, and synchronization patterns
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameStateUtils = exports.InMemoryGameStateManager = exports.GameStateManager = exports.GameStatus = void 0;
var GameStatus;
(function (GameStatus) {
    GameStatus["WAITING"] = "WAITING";
    GameStatus["ACTIVE"] = "ACTIVE";
    GameStatus["PAUSED"] = "PAUSED";
    GameStatus["FINISHED"] = "FINISHED";
})(GameStatus || (exports.GameStatus = GameStatus = {}));
/**
 * Abstract base class for game state management
 */
class GameStateManager {
    gameId;
    currentState;
    subscribers = new Set();
    constructor(gameId, initialState) {
        this.gameId = gameId;
        this.currentState = initialState;
    }
    /**
     * Get current game state
     */
    getState() {
        return { ...this.currentState };
    }
    /**
     * Update game state with validation
     */
    async updateState(updates, playerId, reason) {
        const previousState = { ...this.currentState };
        // Validate the state update
        const validation = await this.validateStateUpdate(updates, previousState);
        if (!validation.isValid) {
            throw new Error(validation.error || 'Invalid state update');
        }
        // Apply the updates
        const newState = {
            ...this.currentState,
            ...updates,
            updatedAt: new Date()
        };
        // Persist the new state
        await this.persistState(newState);
        this.currentState = newState;
        // Notify subscribers
        const updateData = {
            gameId: this.gameId,
            updates,
            timestamp: new Date(),
            playerId,
            reason
        };
        this.notifySubscribers(newState, updateData);
        return true;
    }
    /**
     * Handle game status transitions with validation
     */
    async transitionStatus(newStatus, playerId, reason) {
        const currentStatus = this.currentState.status;
        if (!this.isValidStatusTransition(currentStatus, newStatus)) {
            throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
        }
        return await this.updateState({ status: newStatus }, playerId, reason);
    }
    /**
     * Add a player to the game
     */
    async addPlayer(playerId) {
        if (this.currentState.currentPlayers.includes(playerId)) {
            return false; // Player already in game
        }
        if (this.currentState.currentPlayers.length >= this.currentState.maxPlayers) {
            throw new Error('Game is full');
        }
        const newPlayers = [...this.currentState.currentPlayers, playerId];
        await this.updateState({ currentPlayers: newPlayers }, playerId, 'player_joined');
        // Auto-start game if full
        if (newPlayers.length === this.currentState.maxPlayers && this.currentState.status === GameStatus.WAITING) {
            await this.transitionStatus(GameStatus.ACTIVE, playerId, 'game_full');
        }
        return true;
    }
    /**
     * Remove a player from the game
     */
    async removePlayer(playerId) {
        const playerIndex = this.currentState.currentPlayers.indexOf(playerId);
        if (playerIndex === -1) {
            return false; // Player not in game
        }
        const newPlayers = this.currentState.currentPlayers.filter(p => p !== playerId);
        await this.updateState({ currentPlayers: newPlayers }, playerId, 'player_left');
        // Handle game state when players leave
        if (newPlayers.length === 0 && this.currentState.status === GameStatus.ACTIVE) {
            await this.transitionStatus(GameStatus.FINISHED, playerId, 'all_players_left');
        }
        return true;
    }
    /**
     * Subscribe to state changes
     */
    subscribe(subscriber) {
        this.subscribers.add(subscriber);
    }
    /**
     * Unsubscribe from state changes
     */
    unsubscribe(subscriber) {
        this.subscribers.delete(subscriber);
    }
    /**
     * Notify all subscribers of state changes
     */
    notifySubscribers(newState, updateData) {
        this.subscribers.forEach(subscriber => {
            try {
                subscriber.onStateUpdate(newState, updateData);
            }
            catch (error) {
                console.error('Error in state subscriber:', error);
            }
        });
    }
    /**
     * Validate status transitions
     */
    isValidStatusTransition(from, to) {
        const validTransitions = {
            [GameStatus.WAITING]: [GameStatus.ACTIVE, GameStatus.FINISHED],
            [GameStatus.ACTIVE]: [GameStatus.PAUSED, GameStatus.FINISHED],
            [GameStatus.PAUSED]: [GameStatus.ACTIVE, GameStatus.FINISHED],
            [GameStatus.FINISHED]: [] // Terminal state
        };
        return validTransitions[from].includes(to);
    }
}
exports.GameStateManager = GameStateManager;
/**
 * In-memory GameStateManager for testing and simple games
 */
class InMemoryGameStateManager extends GameStateManager {
    stateHistory = [];
    async validateStateUpdate(_updates, _currentState) {
        // Basic validation - can be overridden
        return { isValid: true };
    }
    async persistState(state) {
        // Store in history for debugging/testing
        this.stateHistory.push({ ...state });
    }
    /**
     * Get state history for testing/debugging
     */
    getStateHistory() {
        return [...this.stateHistory];
    }
    /**
     * Clear state history
     */
    clearHistory() {
        this.stateHistory = [];
    }
}
exports.InMemoryGameStateManager = InMemoryGameStateManager;
/**
 * Utility functions for game state management
 */
class GameStateUtils {
    /**
     * Create initial game state
     */
    static createInitialState(gameId, maxPlayers, additionalProperties) {
        const now = new Date();
        const baseState = {
            gameId,
            status: GameStatus.WAITING,
            createdAt: now,
            updatedAt: now,
            maxPlayers,
            currentPlayers: [],
            metadata: {}
        };
        return Object.assign(baseState, additionalProperties || {});
    }
    /**
     * Check if game can accept new players
     */
    static canAcceptPlayer(state) {
        return state.status === GameStatus.WAITING &&
            state.currentPlayers.length < state.maxPlayers;
    }
    /**
     * Check if game is in progress
     */
    static isInProgress(state) {
        return state.status === GameStatus.ACTIVE || state.status === GameStatus.PAUSED;
    }
    /**
     * Check if game is finished
     */
    static isFinished(state) {
        return state.status === GameStatus.FINISHED;
    }
}
exports.GameStateUtils = GameStateUtils;
//# sourceMappingURL=GameState.js.map