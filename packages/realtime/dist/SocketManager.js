"use strict";
/**
 * Universal SocketManager for real-time multiplayer games
 * Extracted from Territory Conquest's WebSocket implementation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSocketConfig = exports.SocketManager = void 0;
const socket_io_1 = require("socket.io");
/**
 * Universal WebSocket manager for multiplayer games
 */
class SocketManager {
    io;
    gameHandlers = new Map();
    chunkSubscriptions = new Map(); // socketId -> chunkIds
    constructor(httpServer, config) {
        this.io = new socket_io_1.Server(httpServer, config);
        this.setupConnectionHandling();
    }
    /**
     * Register a game-specific socket handler
     */
    registerGameHandler(gameType, handler) {
        this.gameHandlers.set(gameType, handler);
    }
    /**
     * Broadcast update to all players in a game
     */
    broadcastToGame(gameId, event, data) {
        this.io.to(`game:${gameId}`).emit(event, data);
    }
    /**
     * Broadcast update to specific chunk subscribers
     */
    broadcastToChunk(gameId, chunkId, event, data) {
        const room = `game:${gameId}:chunk:${chunkId}`;
        this.io.to(room).emit(event, data);
    }
    /**
     * Send update to specific socket
     */
    sendToSocket(socketId, event, data) {
        this.io.to(socketId).emit(event, data);
    }
    /**
     * Handle game move broadcast
     */
    handleGameMove(gameUpdate) {
        const { gameId, type, data } = gameUpdate;
        switch (type) {
            case 'move':
                this.broadcastToGame(gameId, 'move-made', data);
                break;
            case 'state-change':
                this.broadcastToGame(gameId, 'state-updated', data);
                break;
            case 'player-joined':
                this.broadcastToGame(gameId, 'player-joined', data);
                break;
            case 'player-left':
                this.broadcastToGame(gameId, 'player-left', data);
                break;
        }
    }
    /**
     * Handle chunk-specific updates
     */
    handleChunkUpdate(gameId, chunkId, data) {
        this.broadcastToChunk(gameId, chunkId, 'chunk-updated', {
            gameId,
            chunkId,
            changes: data,
            timestamp: new Date()
        });
    }
    /**
     * Get connected socket count for a game
     */
    getGamePlayerCount(gameId) {
        const room = this.io.sockets.adapter.rooms.get(`game:${gameId}`);
        return room ? room.size : 0;
    }
    /**
     * Get all active chunk subscriptions for a game
     */
    getActiveChunks(gameId) {
        const chunks = new Set();
        // Iterate through all rooms to find chunk subscriptions
        for (const [roomName, sockets] of this.io.sockets.adapter.rooms) {
            if (roomName.startsWith(`game:${gameId}:chunk:`) && sockets.size > 0) {
                const chunkId = roomName.replace(`game:${gameId}:chunk:`, '');
                chunks.add(chunkId);
            }
        }
        return Array.from(chunks);
    }
    /**
     * Setup core WebSocket connection handling
     */
    setupConnectionHandling() {
        this.io.on('connection', (socket) => {
            console.log('User connected:', socket.id);
            // Store socket metadata
            socket.data = {
                joinedGames: new Set(),
                subscribedChunks: new Set()
            };
            // Game room management
            socket.on('join-game', (data) => {
                this.handleJoinGame(socket, data);
            });
            socket.on('leave-game', (gameId) => {
                this.handleLeaveGame(socket, gameId);
            });
            // Chunk subscription management
            socket.on('subscribe-chunk', (data) => {
                this.handleSubscribeChunk(socket, data);
            });
            socket.on('unsubscribe-chunk', (data) => {
                this.handleUnsubscribeChunk(socket, data);
            });
            // Game-specific events
            socket.on('game-move', (data) => {
                this.handleSocketGameMove(socket, data);
            });
            socket.on('game-state-change', (data) => {
                this.handleSocketStateChange(socket, data);
            });
            // Connection cleanup
            socket.on('disconnect', (reason) => {
                this.handleDisconnect(socket, reason);
            });
            socket.on('error', (error) => {
                console.error(`Socket error for ${socket.id}:`, error);
            });
        });
    }
    handleJoinGame(socket, { gameId, gameType }) {
        try {
            socket.join(`game:${gameId}`);
            socket.data.joinedGames.add(gameId);
            console.log(`Socket ${socket.id} joined game ${gameId}`);
            // Notify game-specific handler
            if (gameType && this.gameHandlers.has(gameType)) {
                const handler = this.gameHandlers.get(gameType);
                handler.onPlayerJoined?.(socket, gameId);
            }
            // Broadcast to other players in the game
            socket.to(`game:${gameId}`).emit('player-connected', {
                socketId: socket.id,
                gameId,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Error joining game:', error);
            socket.emit('error', { type: 'join-game-failed', error: error.message });
        }
    }
    handleLeaveGame(socket, gameId) {
        try {
            socket.leave(`game:${gameId}`);
            socket.data.joinedGames.delete(gameId);
            console.log(`Socket ${socket.id} left game ${gameId}`);
            // Clean up chunk subscriptions for this game
            const chunksToRemove = [];
            for (const chunkRoom of socket.data.subscribedChunks) {
                if (chunkRoom.startsWith(`game:${gameId}:chunk:`)) {
                    socket.leave(chunkRoom);
                    chunksToRemove.push(chunkRoom);
                }
            }
            chunksToRemove.forEach(chunk => socket.data.subscribedChunks.delete(chunk));
            // Broadcast to remaining players
            socket.to(`game:${gameId}`).emit('player-disconnected', {
                socketId: socket.id,
                gameId,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Error leaving game:', error);
        }
    }
    handleSubscribeChunk(socket, { gameId, chunkId }) {
        try {
            const room = `game:${gameId}:chunk:${chunkId}`;
            socket.join(room);
            socket.data.subscribedChunks.add(room);
            console.log(`Socket ${socket.id} subscribed to chunk ${chunkId} in game ${gameId}`);
        }
        catch (error) {
            console.error('Error subscribing to chunk:', error);
        }
    }
    handleUnsubscribeChunk(socket, { gameId, chunkId }) {
        try {
            const room = `game:${gameId}:chunk:${chunkId}`;
            socket.leave(room);
            socket.data.subscribedChunks.delete(room);
        }
        catch (error) {
            console.error('Error unsubscribing from chunk:', error);
        }
    }
    handleSocketGameMove(socket, data) {
        try {
            // Broadcast to other players in the game (not sender)
            socket.to(`game:${data.gameId}`).emit('move-made', {
                ...data,
                socketId: socket.id,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Error broadcasting game move:', error);
        }
    }
    handleSocketStateChange(socket, data) {
        try {
            socket.to(`game:${data.gameId}`).emit('state-updated', {
                ...data,
                socketId: socket.id,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('Error broadcasting state change:', error);
        }
    }
    handleDisconnect(socket, reason) {
        console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
        // Clean up all subscriptions
        for (const gameId of socket.data.joinedGames) {
            socket.to(`game:${gameId}`).emit('player-disconnected', {
                socketId: socket.id,
                gameId,
                reason,
                timestamp: new Date()
            });
        }
    }
    /**
     * Shutdown the socket server gracefully
     */
    shutdown() {
        return new Promise((resolve) => {
            this.io.close(() => {
                console.log('SocketManager shut down gracefully');
                resolve();
            });
        });
    }
}
exports.SocketManager = SocketManager;
/**
 * Default socket configuration
 */
exports.defaultSocketConfig = {
    cors: {
        origin: [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:5174',
            'http://127.0.0.1:5174'
        ],
        credentials: true,
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
};
//# sourceMappingURL=SocketManager.js.map