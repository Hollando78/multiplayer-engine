"use strict";
/**
 * Prisma implementation of GameStorage
 * Compatible with Territory Conquest's database schema
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaGameStorage = void 0;
const GameStorage_1 = require("./GameStorage");
class PrismaGameStorage extends GameStorage_1.GameStorage {
    prisma;
    constructor(prisma) {
        super();
        this.prisma = prisma;
    }
    /**
     * Create a new game with owner as first player
     */
    async createGame(ownerId, data) {
        const game = await this.prisma.game.create({
            data: {
                title: data.title,
                gameType: data.gameType,
                maxPlayers: data.maxPlayers || 2,
                ownerId,
                gameState: data.initialGameState || {},
                players: {
                    create: {
                        userId: ownerId,
                        playerIndex: 0,
                        isActive: true
                    }
                }
            },
            include: {
                owner: { select: { id: true, username: true } },
                players: {
                    include: {
                        user: { select: { id: true, username: true } }
                    },
                    orderBy: { playerIndex: 'asc' }
                }
            }
        });
        return this.mapGameFromPrisma(game);
    }
    /**
     * Get game by ID with optional includes
     */
    async getGame(gameId, options = {}) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: {
                owner: options.includeOwner ? { select: { id: true, username: true } } : false,
                players: options.includePlayers ? {
                    include: {
                        user: { select: { id: true, username: true } }
                    },
                    orderBy: { playerIndex: 'asc' }
                } : false
            }
        });
        return game ? this.mapGameFromPrisma(game) : null;
    }
    /**
     * Get games for a user (owned or participating)
     */
    async getGamesForUser(userId, options = {}) {
        const where = {
            OR: [
                { ownerId: userId },
                { players: { some: { userId, isActive: true } } }
            ]
        };
        if (options.gameType) {
            where.gameType = options.gameType;
        }
        if (options.status) {
            where.status = options.status;
        }
        const orderBy = {};
        const orderField = options.orderBy || 'updatedAt';
        const orderDirection = options.orderDirection || 'desc';
        orderBy[orderField] = orderDirection;
        const games = await this.prisma.game.findMany({
            where,
            include: {
                owner: options.includeOwner ? { select: { id: true, username: true } } : false,
                players: options.includePlayers ? {
                    include: {
                        user: { select: { id: true, username: true } }
                    },
                    orderBy: { playerIndex: 'asc' }
                } : false,
                _count: { select: { players: true } }
            },
            orderBy
        });
        return games.map(game => this.mapGameFromPrisma(game));
    }
    /**
     * Update game state and increment state version
     */
    async updateGameState(gameId, gameState, expectedVersion) {
        // Use optimistic concurrency control if expected version provided
        const updateData = {
            gameState,
            stateVersion: { increment: 1 }
        };
        const where = { id: gameId };
        if (expectedVersion !== undefined) {
            where.stateVersion = expectedVersion;
        }
        try {
            const game = await this.prisma.game.update({
                where,
                data: updateData,
                include: {
                    owner: { select: { id: true, username: true } },
                    players: {
                        include: {
                            user: { select: { id: true, username: true } }
                        },
                        orderBy: { playerIndex: 'asc' }
                    }
                }
            });
            return this.mapGameFromPrisma(game);
        }
        catch (error) {
            if (error.code === 'P2025') { // Record not found
                throw new Error('Game not found or version conflict');
            }
            throw error;
        }
    }
    /**
     * Update game status
     */
    async updateGameStatus(gameId, status) {
        const game = await this.prisma.game.update({
            where: { id: gameId },
            data: { status },
            include: {
                owner: { select: { id: true, username: true } },
                players: {
                    include: {
                        user: { select: { id: true, username: true } }
                    },
                    orderBy: { playerIndex: 'asc' }
                }
            }
        });
        return this.mapGameFromPrisma(game);
    }
    /**
     * Join a game as a player
     */
    async joinGame(gameId, userId) {
        // First check if user is already in the game
        const existingPlayer = await this.prisma.gamePlayer.findUnique({
            where: {
                gameId_userId: { gameId, userId }
            }
        });
        if (existingPlayer) {
            const game = await this.getGame(gameId, { includeOwner: true, includePlayers: true });
            return {
                game: game,
                playerIndex: existingPlayer.playerIndex
            };
        }
        // Get the next available player index
        const maxPlayerIndex = await this.prisma.gamePlayer.aggregate({
            where: { gameId },
            _max: { playerIndex: true }
        });
        const nextPlayerIndex = (maxPlayerIndex._max.playerIndex || -1) + 1;
        // Create new game player
        await this.prisma.gamePlayer.create({
            data: {
                gameId,
                userId,
                playerIndex: nextPlayerIndex,
                isActive: true
            }
        });
        // Update game status if it becomes full
        const game = await this.getGame(gameId, { includeOwner: true, includePlayers: true });
        if (game && game.players && game.players.length >= game.maxPlayers) {
            await this.updateGameStatus(gameId, 'ACTIVE');
        }
        const updatedGame = await this.getGame(gameId, { includeOwner: true, includePlayers: true });
        return {
            game: updatedGame,
            playerIndex: nextPlayerIndex
        };
    }
    /**
     * Leave a game
     */
    async leaveGame(gameId, userId) {
        await this.prisma.gamePlayer.updateMany({
            where: { gameId, userId },
            data: { isActive: false }
        });
        // Update game status if no active players remain (except owner)
        const activePlayersCount = await this.getActivePlayersCount(gameId);
        if (activePlayersCount <= 1) {
            await this.updateGameStatus(gameId, 'ABANDONED');
        }
    }
    /**
     * Make a move in a game
     */
    async makeMove(data) {
        // Get current game state for sequence number
        const game = await this.getGame(data.gameId);
        if (!game) {
            throw new Error('Game not found');
        }
        // Get next sequence number
        const maxSequence = await this.prisma.gameMove.aggregate({
            where: { gameId: data.gameId },
            _max: { sequence: true }
        });
        const nextSequence = (maxSequence._max.sequence || 0) + 1;
        // Create the move
        const move = await this.prisma.gameMove.create({
            data: {
                gameId: data.gameId,
                userId: data.userId,
                sequence: nextSequence,
                moveData: data.moveData
            }
        });
        // Return result - state update logic is game-specific
        return {
            move: this.mapMoveFromPrisma(move),
            game,
            stateUpdated: false // This should be handled by game-specific logic
        };
    }
    /**
     * Get moves for a game
     */
    async getGameMoves(gameId, options = {}) {
        const moves = await this.prisma.gameMove.findMany({
            where: { gameId },
            orderBy: { sequence: 'asc' },
            take: options.limit,
            skip: options.offset
        });
        return moves.map(move => this.mapMoveFromPrisma(move));
    }
    /**
     * Delete a game (only by owner)
     */
    async deleteGame(gameId, ownerId) {
        // Verify ownership before deletion
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            select: { ownerId: true }
        });
        if (!game) {
            throw new Error('Game not found');
        }
        if (game.ownerId !== ownerId) {
            throw new Error('Only game owner can delete the game');
        }
        await this.prisma.game.delete({
            where: { id: gameId }
        });
    }
    /**
     * Check if user can access game (owner or player)
     */
    async checkGameAccess(gameId, userId) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            select: {
                ownerId: true,
                players: {
                    where: { userId, isActive: true },
                    select: { id: true }
                }
            }
        });
        if (!game) {
            return { canAccess: false, isOwner: false };
        }
        const isOwner = game.ownerId === userId;
        const isPlayer = game.players.length > 0;
        const canAccess = isOwner || isPlayer;
        return { canAccess, isOwner };
    }
    /**
     * Get active players count for a game
     */
    async getActivePlayersCount(gameId) {
        const count = await this.prisma.gamePlayer.count({
            where: { gameId, isActive: true }
        });
        return count;
    }
    /**
     * Clean up abandoned games
     */
    async cleanupAbandonedGames(olderThan) {
        const result = await this.prisma.game.deleteMany({
            where: {
                status: 'ABANDONED',
                updatedAt: {
                    lt: olderThan
                }
            }
        });
        return result.count;
    }
    /**
     * Map Prisma game object to GameStorage interface
     */
    mapGameFromPrisma(prismaGame) {
        return {
            id: prismaGame.id,
            title: prismaGame.title,
            gameType: prismaGame.gameType,
            status: prismaGame.status,
            maxPlayers: prismaGame.maxPlayers,
            ownerId: prismaGame.ownerId,
            stateVersion: prismaGame.stateVersion,
            gameState: prismaGame.gameState,
            createdAt: prismaGame.createdAt,
            updatedAt: prismaGame.updatedAt,
            owner: prismaGame.owner ? {
                id: prismaGame.owner.id,
                username: prismaGame.owner.username
            } : undefined,
            players: prismaGame.players ? prismaGame.players.map((player) => ({
                id: player.id,
                userId: player.userId,
                gameId: player.gameId,
                playerIndex: player.playerIndex,
                joinedAt: player.joinedAt,
                isActive: player.isActive,
                user: player.user ? {
                    id: player.user.id,
                    username: player.user.username
                } : undefined
            })) : undefined
        };
    }
    /**
     * Map Prisma move object to GameMove interface
     */
    mapMoveFromPrisma(prismaMove) {
        return {
            id: prismaMove.id,
            gameId: prismaMove.gameId,
            userId: prismaMove.userId,
            sequence: prismaMove.sequence,
            moveData: prismaMove.moveData,
            timestamp: prismaMove.timestamp || prismaMove.createdAt
        };
    }
}
exports.PrismaGameStorage = PrismaGameStorage;
//# sourceMappingURL=PrismaGameStorage.js.map