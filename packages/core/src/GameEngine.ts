/**
 * Base abstract class for all multiplayer game engines.
 * Provides common patterns for move validation, state management, and resource handling.
 */
export abstract class GameEngine<TGameState = any, TMoveData = any, TGameRules = any> {
  protected gameId: string;
  protected rules: TGameRules;
  protected state: TGameState | undefined;
  protected resourceManager: BaseResourceManager;
  protected validator: MoveValidator<TMoveData>;

  constructor(gameId: string, rules: TGameRules) {
    this.gameId = gameId;
    this.rules = rules;
    this.resourceManager = this.createResourceManager();
    this.validator = this.createMoveValidator();
  }

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
  async makeMove(playerId: string, moveData: TMoveData): Promise<MoveResult> {
    try {
      // 1. Check if player has sufficient resources
      const hasResources = await this.resourceManager.canSpend(playerId);
      if (!hasResources) {
        return { success: false, error: 'Insufficient resources' };
      }

      // 2. Validate the move according to game rules
      const isValid = await this.validateMove(playerId, moveData);
      if (!isValid) {
        return { success: false, error: 'Invalid move' };
      }

      // 3. Apply the move and get results
      const result = await this.applyMove(playerId, moveData);
      if (!result.success) {
        return result;
      }

      // 4. Spend player resources
      await this.resourceManager.spendResource(playerId);

      // 5. Check for win conditions
      const winResult = await this.checkWinCondition();
      if (winResult.hasWinner) {
        result.winResult = winResult;
      }

      return result;
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get current game state for synchronization
   */
  async getFullGameState(): Promise<GameStateSnapshot<TGameState>> {
    return {
      gameId: this.gameId,
      state: await this.getGameState(),
      scores: await this.calculateScore(),
      rules: this.rules,
      lastUpdated: new Date()
    };
  }
}

/**
 * Base class for resource management - will be implemented by concrete ResourceManager
 */
export abstract class BaseResourceManager {
  protected config: ResourceConfig;

  constructor(config: ResourceConfig) {
    this.config = config;
  }

  abstract canSpend(playerId: string): Promise<boolean>;
  abstract spendResource(playerId: string): Promise<any>;
}

/**
 * Base class for move validation
 */
export abstract class MoveValidator<TMoveData = any> {
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