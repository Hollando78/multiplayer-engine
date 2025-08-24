/**
 * Universal SocketManager for real-time multiplayer games
 * Extracted from Territory Conquest's WebSocket implementation
 */
import { Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
export interface SocketConfig {
    cors: {
        origin: string[];
        credentials: boolean;
        methods: string[];
    };
    transports: ('websocket' | 'polling')[];
    allowEIO3: boolean;
    pingTimeout: number;
    pingInterval: number;
}
export interface GameUpdate {
    gameId: string;
    type: 'move' | 'state-change' | 'player-joined' | 'player-left';
    data: any;
    timestamp: Date;
    playerId?: string;
}
export interface ChunkSubscription {
    gameId: string;
    chunkId: string;
    playerId?: string;
}
/**
 * Universal WebSocket manager for multiplayer games
 */
export declare class SocketManager {
    private io;
    private gameHandlers;
    private chunkSubscriptions;
    constructor(httpServer: HTTPServer, config: SocketConfig);
    /**
     * Register a game-specific socket handler
     */
    registerGameHandler(gameType: string, handler: GameSocketHandler): void;
    /**
     * Broadcast update to all players in a game
     */
    broadcastToGame(gameId: string, event: string, data: any): void;
    /**
     * Broadcast update to specific chunk subscribers
     */
    broadcastToChunk(gameId: string, chunkId: string, event: string, data: any): void;
    /**
     * Send update to specific socket
     */
    sendToSocket(socketId: string, event: string, data: any): void;
    /**
     * Handle game move broadcast
     */
    handleGameMove(gameUpdate: GameUpdate): void;
    /**
     * Handle chunk-specific updates
     */
    handleChunkUpdate(gameId: string, chunkId: string, data: any): void;
    /**
     * Get connected socket count for a game
     */
    getGamePlayerCount(gameId: string): number;
    /**
     * Get all active chunk subscriptions for a game
     */
    getActiveChunks(gameId: string): string[];
    /**
     * Setup core WebSocket connection handling
     */
    private setupConnectionHandling;
    private handleJoinGame;
    private handleLeaveGame;
    private handleSubscribeChunk;
    private handleUnsubscribeChunk;
    private handleSocketGameMove;
    private handleSocketStateChange;
    private handleDisconnect;
    /**
     * Shutdown the socket server gracefully
     */
    shutdown(): Promise<void>;
}
/**
 * Interface for game-specific socket handlers
 */
export interface GameSocketHandler {
    onPlayerJoined?(socket: Socket, gameId: string): void;
    onPlayerLeft?(socket: Socket, gameId: string): void;
    onCustomEvent?(socket: Socket, event: string, data: any): void;
}
/**
 * Default socket configuration
 */
export declare const defaultSocketConfig: SocketConfig;
//# sourceMappingURL=SocketManager.d.ts.map