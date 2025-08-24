/**
 * Universal client-side socket manager for connecting to multiplayer games
 * Provides high-level API for game clients to interact with real-time systems
 */
import { ViewportBounds } from './ChunkUpdater';
export interface ClientConfig {
    url: string;
    options?: {
        transports?: string[];
        timeout?: number;
        forceNew?: boolean;
        reconnection?: boolean;
        reconnectionAttempts?: number;
        reconnectionDelay?: number;
    };
}
export interface GameEventData {
    gameId: string;
    type: string;
    data: any;
    timestamp: Date;
}
export interface ChunkUpdateData {
    gameId: string;
    chunkId: string;
    changes: any[];
    timestamp: Date;
}
/**
 * Client-side WebSocket manager for multiplayer games
 */
export declare class SocketClient {
    private socket;
    private config;
    private currentGameId;
    private subscribedChunks;
    private eventHandlers;
    private reconnectAttempts;
    private maxReconnectAttempts;
    constructor(config: ClientConfig);
    /**
     * Connect to the server
     */
    connect(): Promise<void>;
    /**
     * Join a game room
     */
    joinGame(gameId: string, gameType?: string): Promise<void>;
    /**
     * Leave current game
     */
    leaveGame(): Promise<void>;
    /**
     * Subscribe to chunks within a viewport
     */
    subscribeToViewport(viewport: ViewportBounds): Promise<void>;
    /**
     * Send a game move to other players
     */
    sendMove(moveData: any): void;
    /**
     * Send a game state change to other players
     */
    sendStateChange(stateData: any): void;
    /**
     * Listen for specific game events
     */
    on(event: string, handler: Function): void;
    /**
     * Remove event listener
     */
    off(event: string, handler?: Function): void;
    /**
     * Listen for move updates from other players
     */
    onMove(handler: (data: GameEventData) => void): void;
    /**
     * Listen for state updates from other players
     */
    onStateUpdate(handler: (data: GameEventData) => void): void;
    /**
     * Listen for chunk updates
     */
    onChunkUpdate(handler: (data: ChunkUpdateData) => void): void;
    /**
     * Listen for player join/leave events
     */
    onPlayerEvent(handler: (data: {
        event: string;
        playerId?: string;
        data: any;
    }) => void): void;
    /**
     * Get connection status
     */
    isConnected(): boolean;
    /**
     * Get current game ID
     */
    getCurrentGameId(): string | null;
    /**
     * Get subscribed chunks
     */
    getSubscribedChunks(): string[];
    /**
     * Disconnect from server
     */
    disconnect(): void;
    private createSocket;
    private setupEventHandlers;
    private emit;
    private unsubscribeFromAllChunks;
    private calculateVisibleChunks;
}
/**
 * Default client configuration
 */
export declare const defaultClientConfig: Omit<ClientConfig, 'url'>;
//# sourceMappingURL=SocketClient.d.ts.map