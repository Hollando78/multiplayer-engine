"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoveValidator = exports.BaseResourceManager = exports.GameEngine = void 0;
/**
 * Base abstract class for all multiplayer game engines.
 * Provides common patterns for move validation, state management, and resource handling.
 */
class GameEngine {
    gameId;
    rules;
    state;
    resourceManager;
    validator;
    constructor(gameId, rules) {
        this.gameId = gameId;
        this.rules = rules;
        this.resourceManager = this.createResourceManager();
        this.validator = this.createMoveValidator();
    }
    /**
     * Universal move processing pipeline
     * This is the main entry point for all game moves
     */
    async makeMove(playerId, moveData) {
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
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Get current game state for synchronization
     */
    async getFullGameState() {
        return {
            gameId: this.gameId,
            state: await this.getGameState(),
            scores: await this.calculateScore(),
            rules: this.rules,
            lastUpdated: new Date()
        };
    }
}
exports.GameEngine = GameEngine;
/**
 * Base class for resource management - will be implemented by concrete ResourceManager
 */
class BaseResourceManager {
    config;
    constructor(config) {
        this.config = config;
    }
}
exports.BaseResourceManager = BaseResourceManager;
/**
 * Base class for move validation
 */
class MoveValidator {
}
exports.MoveValidator = MoveValidator;
//# sourceMappingURL=GameEngine.js.map