/**
 * GameState - Central state management system for multiplayer games
 * Provides state tracking, transitions, and synchronization patterns
 */

export enum GameStatus {
  WAITING = 'WAITING',
  ACTIVE = 'ACTIVE', 
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED'
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
export abstract class GameStateManager<T extends BaseGameState = BaseGameState> {
  protected gameId: string;
  protected currentState: T;
  protected subscribers: Set<StateSubscriber<T>> = new Set();

  constructor(gameId: string, initialState: T) {
    this.gameId = gameId;
    this.currentState = initialState;
  }

  /**
   * Get current game state
   */
  getState(): T {
    return { ...this.currentState };
  }

  /**
   * Update game state with validation
   */
  async updateState(updates: Partial<T>, playerId?: string, reason?: string): Promise<boolean> {
    const previousState = { ...this.currentState };
    
    // Validate the state update
    const validation = await this.validateStateUpdate(updates, previousState);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid state update');
    }

    // Apply the updates
    const newState: T = {
      ...this.currentState,
      ...updates,
      updatedAt: new Date()
    };

    // Persist the new state
    await this.persistState(newState);
    this.currentState = newState;

    // Notify subscribers
    const updateData: GameStateUpdate<T> = {
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
  async transitionStatus(newStatus: GameStatus, playerId?: string, reason?: string): Promise<boolean> {
    const currentStatus = this.currentState.status;
    
    if (!this.isValidStatusTransition(currentStatus, newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }

    return await this.updateState({ status: newStatus } as Partial<T>, playerId, reason);
  }

  /**
   * Add a player to the game
   */
  async addPlayer(playerId: string): Promise<boolean> {
    if (this.currentState.currentPlayers.includes(playerId)) {
      return false; // Player already in game
    }

    if (this.currentState.currentPlayers.length >= this.currentState.maxPlayers) {
      throw new Error('Game is full');
    }

    const newPlayers = [...this.currentState.currentPlayers, playerId];
    await this.updateState({ currentPlayers: newPlayers } as Partial<T>, playerId, 'player_joined');

    // Auto-start game if full
    if (newPlayers.length === this.currentState.maxPlayers && this.currentState.status === GameStatus.WAITING) {
      await this.transitionStatus(GameStatus.ACTIVE, playerId, 'game_full');
    }

    return true;
  }

  /**
   * Remove a player from the game
   */
  async removePlayer(playerId: string): Promise<boolean> {
    const playerIndex = this.currentState.currentPlayers.indexOf(playerId);
    if (playerIndex === -1) {
      return false; // Player not in game
    }

    const newPlayers = this.currentState.currentPlayers.filter(p => p !== playerId);
    await this.updateState({ currentPlayers: newPlayers } as Partial<T>, playerId, 'player_left');

    // Handle game state when players leave
    if (newPlayers.length === 0 && this.currentState.status === GameStatus.ACTIVE) {
      await this.transitionStatus(GameStatus.FINISHED, playerId, 'all_players_left');
    }

    return true;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(subscriber: StateSubscriber<T>): void {
    this.subscribers.add(subscriber);
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(subscriber: StateSubscriber<T>): void {
    this.subscribers.delete(subscriber);
  }

  /**
   * Notify all subscribers of state changes
   */
  protected notifySubscribers(newState: T, updateData: GameStateUpdate<T>): void {
    this.subscribers.forEach(subscriber => {
      try {
        subscriber.onStateUpdate(newState, updateData);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });
  }

  /**
   * Validate status transitions
   */
  protected isValidStatusTransition(from: GameStatus, to: GameStatus): boolean {
    const validTransitions: Record<GameStatus, GameStatus[]> = {
      [GameStatus.WAITING]: [GameStatus.ACTIVE, GameStatus.FINISHED],
      [GameStatus.ACTIVE]: [GameStatus.PAUSED, GameStatus.FINISHED],
      [GameStatus.PAUSED]: [GameStatus.ACTIVE, GameStatus.FINISHED],
      [GameStatus.FINISHED]: [] // Terminal state
    };

    return validTransitions[from].includes(to);
  }

  // Abstract methods for game-specific implementation
  protected abstract validateStateUpdate(updates: Partial<T>, currentState: T): Promise<ValidationResult>;
  protected abstract persistState(state: T): Promise<void>;
}

/**
 * In-memory GameStateManager for testing and simple games
 */
export class InMemoryGameStateManager<T extends BaseGameState> extends GameStateManager<T> {
  private stateHistory: T[] = [];

  protected async validateStateUpdate(_updates: Partial<T>, _currentState: T): Promise<ValidationResult> {
    // Basic validation - can be overridden
    return { isValid: true };
  }

  protected async persistState(state: T): Promise<void> {
    // Store in history for debugging/testing
    this.stateHistory.push({ ...state });
  }

  /**
   * Get state history for testing/debugging
   */
  getStateHistory(): T[] {
    return [...this.stateHistory];
  }

  /**
   * Clear state history
   */
  clearHistory(): void {
    this.stateHistory = [];
  }
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
export class GameStateUtils {
  /**
   * Create initial game state
   */
  static createInitialState<T extends BaseGameState>(
    gameId: string,
    maxPlayers: number,
    additionalProperties?: Omit<T, keyof BaseGameState>
  ): T {
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
    
    return Object.assign(baseState, additionalProperties || {}) as unknown as T;
  }

  /**
   * Check if game can accept new players
   */
  static canAcceptPlayer(state: BaseGameState): boolean {
    return state.status === GameStatus.WAITING && 
           state.currentPlayers.length < state.maxPlayers;
  }

  /**
   * Check if game is in progress
   */
  static isInProgress(state: BaseGameState): boolean {
    return state.status === GameStatus.ACTIVE || state.status === GameStatus.PAUSED;
  }

  /**
   * Check if game is finished
   */
  static isFinished(state: BaseGameState): boolean {
    return state.status === GameStatus.FINISHED;
  }
}