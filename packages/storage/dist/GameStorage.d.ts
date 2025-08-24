/**
 * Universal game storage abstractions
 * Extracted from Territory Conquest's game management system
 */
export interface GamePlayer {
    id: string;
    userId: string;
    gameId: string;
    playerIndex: number;
    joinedAt: Date;
    isActive: boolean;
    user?: {
        id: string;
        username: string;
    };
}
export interface Game {
    id: string;
    title: string;
    gameType: string;
    status: 'WAITING' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
    maxPlayers: number;
    ownerId: string;
    stateVersion: number;
    gameState?: any;
    createdAt: Date;
    updatedAt: Date;
    owner?: {
        id: string;
        username: string;
    };
    players?: GamePlayer[];
}
export interface GameMove {
    id: string;
    gameId: string;
    userId: string;
    sequence: number;
    moveData: any;
    timestamp: Date;
}
export interface CreateGameData {
    title: string;
    gameType: string;
    maxPlayers?: number;
    initialGameState?: any;
}
export interface JoinGameResult {
    game: Game;
    playerIndex: number;
}
export interface GameListOptions {
    userId?: string;
    gameType?: string;
    status?: Game['status'];
    includeOwner?: boolean;
    includePlayers?: boolean;
    orderBy?: 'createdAt' | 'updatedAt' | 'title';
    orderDirection?: 'asc' | 'desc';
}
export interface MakeMoveData {
    gameId: string;
    userId: string;
    moveData: any;
    expectedStateVersion?: number;
}
export interface MakeMoveResult {
    move: GameMove;
    game: Game;
    stateUpdated: boolean;
}
/**
 * Abstract storage interface for game data
 */
export declare abstract class GameStorage {
    /**
     * Create a new game
     */
    abstract createGame(ownerId: string, data: CreateGameData): Promise<Game>;
    /**
     * Get game by ID with optional includes
     */
    abstract getGame(gameId: string, options?: {
        includeOwner?: boolean;
        includePlayers?: boolean;
    }): Promise<Game | null>;
    /**
     * Get games for a user (owned or participating)
     */
    abstract getGamesForUser(userId: string, options?: GameListOptions): Promise<Game[]>;
    /**
     * Update game state and increment state version
     */
    abstract updateGameState(gameId: string, gameState: any, expectedVersion?: number): Promise<Game>;
    /**
     * Update game status
     */
    abstract updateGameStatus(gameId: string, status: Game['status']): Promise<Game>;
    /**
     * Join a game as a player
     */
    abstract joinGame(gameId: string, userId: string): Promise<JoinGameResult>;
    /**
     * Leave a game
     */
    abstract leaveGame(gameId: string, userId: string): Promise<void>;
    /**
     * Make a move in a game
     */
    abstract makeMove(data: MakeMoveData): Promise<MakeMoveResult>;
    /**
     * Get moves for a game
     */
    abstract getGameMoves(gameId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<GameMove[]>;
    /**
     * Delete a game (only by owner)
     */
    abstract deleteGame(gameId: string, ownerId: string): Promise<void>;
    /**
     * Check if user can access game (owner or player)
     */
    abstract checkGameAccess(gameId: string, userId: string): Promise<{
        canAccess: boolean;
        isOwner: boolean;
    }>;
    /**
     * Get active players count for a game
     */
    abstract getActivePlayersCount(gameId: string): Promise<number>;
    /**
     * Clean up abandoned games
     */
    abstract cleanupAbandonedGames(olderThan: Date): Promise<number>;
}
//# sourceMappingURL=GameStorage.d.ts.map