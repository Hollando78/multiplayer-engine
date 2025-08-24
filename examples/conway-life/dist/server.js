"use strict";
/**
 * Conway's Game of Life multiplayer server demonstrating full real-time integration
 * Shows how to use all real-time components together: SocketManager, PubSubManager, ChunkUpdater, StateSync
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeServer = initializeServer;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const realtime_1 = require("@multiplayer-engine/realtime");
const ConwayEngine_1 = require("./ConwayEngine");
// Game instances
const gameInstances = new Map();
// Real-time infrastructure
let socketManager;
let pubSubManager;
let chunkUpdater;
let stateSync;
/**
 * Initialize the server with full real-time multiplayer infrastructure
 */
async function initializeServer() {
    console.log('🚀 Initializing Conway\'s Game of Life multiplayer server...');
    // Create Express app and HTTP server
    const app = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(app);
    app.use(express_1.default.json());
    // Initialize Redis pub/sub system
    console.log('📡 Setting up Redis pub/sub system...');
    pubSubManager = new realtime_1.PubSubManager({
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
        keyPrefix: 'conway:'
    });
    // Initialize WebSocket manager
    console.log('🔌 Setting up WebSocket manager...');
    const socketConfig = {
        ...realtime_1.defaultSocketConfig,
        cors: {
            ...realtime_1.defaultSocketConfig.cors,
            origin: ['http://localhost:3000', 'http://127.0.0.1:3000']
        }
    };
    socketManager = new realtime_1.SocketManager(httpServer, socketConfig);
    // Initialize chunk-based updates system
    console.log('🔲 Setting up chunk update system...');
    chunkUpdater = new realtime_1.ChunkUpdater(socketManager, pubSubManager, 64);
    // Initialize state synchronization
    console.log('🔄 Setting up state synchronization...');
    stateSync = new realtime_1.StateSync(pubSubManager, socketManager, {
        enableOptimisticUpdates: true,
        maxPendingUpdates: 50,
        acknowledgmentTimeout: 3000
    });
    // Register Conway-specific game handler
    socketManager.registerGameHandler('conway', {
        onPlayerJoined: async (socket, gameId) => {
            console.log(`Player ${socket.id} joined Conway's Life game ${gameId}`);
            // Send current game state to new player
            const game = gameInstances.get(gameId);
            if (game) {
                const gameState = await game.getGameState();
                const liveCells = game.getLiveCells();
                socket.emit('game-initialized', {
                    gameState,
                    liveCells,
                    timestamp: new Date()
                });
            }
        },
        onCustomEvent: async (socket, event, data) => {
            if (event === 'place-pattern') {
                await handlePlacePattern(socket.id, data);
            }
            else if (event === 'set-speed') {
                await handleSetSpeed(socket.id, data);
            }
        }
    });
    // Setup API routes
    setupRoutes(app);
    // Setup real-time event handlers
    setupRealtimeHandlers();
    // Start server
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
        console.log(`🌟 Conway's Life server running on port ${PORT}`);
        console.log(`💡 WebSocket endpoint: ws://localhost:${PORT}`);
        console.log(`📊 API endpoint: http://localhost:${PORT}/api`);
    });
}
/**
 * Setup REST API routes
 */
function setupRoutes(app) {
    // Create new game
    app.post('/api/games', async (req, res) => {
        try {
            const gameId = generateGameId();
            const game = new ConwayEngine_1.ConwayEngine(gameId);
            gameInstances.set(gameId, game);
            // Initialize state sync for this game
            stateSync.setGameState(gameId, await game.getGameState());
            console.log(`Created new Conway's Life game: ${gameId}`);
            res.json({
                success: true,
                gameId,
                message: 'Conway\'s Game of Life created successfully'
            });
        }
        catch (error) {
            console.error('Error creating game:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create game'
            });
        }
    });
    // Get game state
    app.get('/api/games/:gameId', async (req, res) => {
        try {
            const { gameId } = req.params;
            const game = gameInstances.get(gameId);
            if (!game) {
                return res.status(404).json({
                    success: false,
                    error: 'Game not found'
                });
            }
            const gameState = await game.getGameState();
            const liveCells = game.getLiveCells();
            res.json({
                success: true,
                gameState,
                liveCells
            });
        }
        catch (error) {
            console.error('Error getting game state:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get game state'
            });
        }
    });
    // Place cell
    app.post('/api/games/:gameId/place', async (req, res) => {
        try {
            const { gameId } = req.params;
            const { x, y, playerId } = req.body;
            const game = gameInstances.get(gameId);
            if (!game) {
                return res.status(404).json({
                    success: false,
                    error: 'Game not found'
                });
            }
            const result = await game.applyGridMove(x, y, playerId || 'anonymous');
            if (result.success && result.changedCells) {
                // Publish chunk updates for real-time synchronization
                await chunkUpdater.publishChunkUpdate(gameId, result.changedCells.map((cell) => ({
                    x: cell.x,
                    y: cell.y,
                    oldValue: null,
                    newValue: cell.owner,
                    playerId
                })));
                // Update state sync
                const newGameState = await game.getGameState();
                await stateSync.applyServerUpdate(gameId, {
                    gameId,
                    updates: { lastMove: { x, y, playerId }, generation: newGameState.generation },
                    timestamp: new Date(),
                    playerId
                });
            }
            res.json(result);
        }
        catch (error) {
            console.error('Error placing cell:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to place cell'
            });
        }
    });
    // Health check
    app.get('/api/health', (req, res) => {
        const stats = chunkUpdater.getSubscriptionStats();
        const pubSubStats = pubSubManager.getStats();
        res.json({
            status: 'healthy',
            timestamp: new Date(),
            games: gameInstances.size,
            chunkStats: stats,
            pubSubStats,
            uptime: process.uptime()
        });
    });
}
/**
 * Setup real-time event handlers
 */
function setupRealtimeHandlers() {
    // Handle viewport changes for chunk subscriptions
    socketManager.registerGameHandler('conway', {
        onCustomEvent: async (socket, event, data) => {
            if (event === 'viewport-changed') {
                const { gameId, viewport } = data;
                console.log(`Player ${socket.id} updated viewport for game ${gameId}`);
                try {
                    const chunkIds = await chunkUpdater.subscribeToViewport(socket.id, gameId, viewport);
                    socket.emit('chunks-subscribed', {
                        gameId,
                        chunkIds,
                        timestamp: new Date()
                    });
                }
                catch (error) {
                    console.error('Error updating viewport subscription:', error);
                    socket.emit('error', { type: 'viewport-subscription-failed', error: error.message });
                }
            }
        }
    });
    // Setup pub/sub handlers for cross-server synchronization
    pubSubManager.subscribeToAllGames(async (channel, message) => {
        if (message.type === 'move') {
            // Forward move updates to WebSocket clients
            socketManager.broadcastToGame(message.gameId, 'cell-placed', {
                x: message.data.x,
                y: message.data.y,
                playerId: message.playerId,
                timestamp: message.timestamp
            });
        }
        else if (message.type === 'state-change') {
            // Forward state changes
            socketManager.broadcastToGame(message.gameId, 'generation-updated', {
                gameId: message.gameId,
                generation: message.data.generation,
                aliveCells: message.data.aliveCells,
                timestamp: message.timestamp
            });
        }
    });
    // Handle disconnections
    socketManager.registerGameHandler('conway', {
        onPlayerLeft: async (socket, gameId) => {
            console.log(`Player ${socket.id} left Conway's Life game ${gameId}`);
            // Clean up chunk subscriptions
            await chunkUpdater.cleanupClient(socket.id);
        }
    });
}
/**
 * Handle pattern placement requests
 */
async function handlePlacePattern(socketId, data) {
    try {
        const { gameId, pattern, x, y, playerId } = data;
        const game = gameInstances.get(gameId);
        if (!game) {
            socketManager.sendToSocket(socketId, 'error', {
                type: 'game-not-found',
                message: `Game ${gameId} not found`
            });
            return;
        }
        const result = game.loadPattern(pattern, x, y, playerId);
        if (result.success && result.changedCells) {
            // Publish chunk updates
            await chunkUpdater.publishChunkUpdate(gameId, result.changedCells.map(cell => ({
                x: cell.x,
                y: cell.y,
                oldValue: null,
                newValue: cell.owner,
                playerId
            })));
            // Broadcast to all players
            socketManager.broadcastToGame(gameId, 'pattern-placed', {
                pattern,
                x,
                y,
                playerId,
                cellsChanged: result.changedCells.length,
                timestamp: new Date()
            });
        }
        else {
            socketManager.sendToSocket(socketId, 'error', {
                type: 'pattern-placement-failed',
                message: result.error || 'Failed to place pattern'
            });
        }
    }
    catch (error) {
        console.error('Error placing pattern:', error);
        socketManager.sendToSocket(socketId, 'error', {
            type: 'pattern-placement-error',
            message: error.message
        });
    }
}
/**
 * Handle speed change requests
 */
async function handleSetSpeed(socketId, data) {
    try {
        const { gameId, speed, playerId } = data;
        const game = gameInstances.get(gameId);
        if (!game) {
            socketManager.sendToSocket(socketId, 'error', {
                type: 'game-not-found',
                message: `Game ${gameId} not found`
            });
            return;
        }
        game.setSpeed(speed);
        // Broadcast speed change to all players
        socketManager.broadcastToGame(gameId, 'speed-changed', {
            speed,
            playerId,
            timestamp: new Date()
        });
        console.log(`Speed changed to ${speed}ms for game ${gameId} by player ${playerId}`);
    }
    catch (error) {
        console.error('Error setting speed:', error);
        socketManager.sendToSocket(socketId, 'error', {
            type: 'speed-change-error',
            message: error.message
        });
    }
}
/**
 * Generate a unique game ID
 */
function generateGameId() {
    return `conway-${Date.now()}-${Math.random().toString(36).substring(2)}`;
}
/**
 * Graceful shutdown handler
 */
async function gracefulShutdown() {
    console.log('🛑 Shutting down Conway\'s Life server gracefully...');
    // Stop all game simulations
    for (const game of gameInstances.values()) {
        game.shutdown();
    }
    gameInstances.clear();
    // Shutdown real-time infrastructure
    if (socketManager) {
        await socketManager.shutdown();
    }
    if (chunkUpdater) {
        chunkUpdater.shutdown();
    }
    if (stateSync) {
        stateSync.shutdown();
    }
    if (pubSubManager) {
        await pubSubManager.shutdown();
    }
    console.log('✨ Server shut down gracefully');
    process.exit(0);
}
// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
// Start the server
if (require.main === module) {
    initializeServer().catch((error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=server.js.map