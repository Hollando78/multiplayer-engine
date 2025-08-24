/**
 * Prisma implementation of GameStorage
 * Compatible with Territory Conquest's database schema
 */
import type { PrismaClient } from '@prisma/client';
import { GameStorage, Game, GameMove, CreateGameData, JoinGameResult, GameListOptions, MakeMoveData, MakeMoveResult } from './GameStorage';
export declare class PrismaGameStorage extends GameStorage {
    private prisma;
    constructor(prisma: PrismaClient);
    /**
     * Create a new game with owner as first player
     */
    createGame(ownerId: string, data: CreateGameData): Promise<Game>;
    /**
     * Get game by ID with optional includes
     */
    getGame(gameId: string, options?: {
        includeOwner?: boolean;
        includePlayers?: boolean;
    }): Promise<Game | null>;
    /**
     * Get games for a user (owned or participating)
     */
    getGamesForUser(userId: string, options?: GameListOptions): Promise<Game[]>;
    /**
     * Update game state and increment state version
     */
    updateGameState(gameId: string, gameState: any, expectedVersion?: number): Promise<Game>;
    /**
     * Update game status
     */
    updateGameStatus(gameId: string, status: Game['status']): Promise<Game>;
    /**
     * Join a game as a player
     */
    joinGame(gameId: string, userId: string): Promise<JoinGameResult>;
    /**
     * Leave a game
     */
    leaveGame(gameId: string, userId: string): Promise<void>;
    /**
     * Make a move in a game
     */
    makeMove(data: MakeMoveData): Promise<MakeMoveResult>;
    /**
     * Get moves for a game
     */
    getGameMoves(gameId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<GameMove[]>;
    /**
     * Delete a game (only by owner)
     */
    deleteGame(gameId: string, ownerId: string): Promise<void>;
    /**
     * Check if user can access game (owner or player)
     */
    checkGameAccess(gameId: string, userId: string): Promise<{
        canAccess: boolean;
        isOwner: boolean;
    }>;
    /**
     * Get active players count for a game
     */
    getActivePlayersCount(gameId: string): Promise<number>;
    /**
     * Clean up abandoned games
     */
    cleanupAbandonedGames(olderThan: Date): Promise<number>;
    /**
     * Map Prisma game object to GameStorage interface
     */
    private mapGameFromPrisma;
    /**
     * Map Prisma move object to GameMove interface
     */
    private mapMoveFromPrisma;
}
//# sourceMappingURL=PrismaGameStorage.d.ts.map