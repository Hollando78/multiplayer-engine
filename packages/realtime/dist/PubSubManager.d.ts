/**
 * Universal Redis pub/sub manager for distributed multiplayer games
 * Extracted from Territory Conquest's Redis infrastructure
 */
export interface PubSubConfig {
    redisUrl?: string;
    retryStrategy?: (times: number) => number;
    maxRetriesPerRequest?: number;
    keyPrefix?: string;
}
export interface GameMessage {
    gameId: string;
    type: 'move' | 'state-change' | 'player-event' | 'chunk-update';
    data: any;
    timestamp: Date;
    playerId?: string;
    chunkId?: string;
}
export interface LockOptions {
    ttlSeconds?: number;
    maxRetries?: number;
    retryDelay?: number;
}
export interface LockResult {
    acquired: boolean;
    lockId?: string;
    release?: () => Promise<void>;
}
/**
 * Universal Redis pub/sub manager for multiplayer games
 */
export declare class PubSubManager {
    private redis;
    private pubClient;
    private subClient;
    private config;
    private messageHandlers;
    private patternHandlers;
    constructor(config?: PubSubConfig);
    /**
     * Publish a game update to all subscribers
     */
    publishGameUpdate(gameId: string, message: Omit<GameMessage, 'gameId' | 'timestamp'>): Promise<number>;
    /**
     * Publish a chunk-specific update
     */
    publishChunkUpdate(gameId: string, chunkId: string, data: any): Promise<number>;
    /**
     * Publish player event (join/leave/move)
     */
    publishPlayerEvent(gameId: string, playerId: string, event: string, data?: any): Promise<number>;
    /**
     * Subscribe to all updates for a specific game
     */
    subscribeToGame(gameId: string, handler: MessageHandler): Promise<void>;
    /**
     * Subscribe to chunk updates for a specific game
     */
    subscribeToGameChunks(gameId: string, handler: MessageHandler): Promise<void>;
    /**
     * Subscribe to all game updates using pattern matching
     */
    subscribeToAllGames(handler: MessageHandler): Promise<void>;
    /**
     * Unsubscribe from a specific game
     */
    unsubscribeFromGame(gameId: string, handler?: MessageHandler): Promise<void>;
    /**
     * Acquire a distributed lock for coordinated operations
     */
    acquireLock(key: string, options?: LockOptions): Promise<LockResult>;
    /**
     * Execute function with distributed lock
     */
    withLock<T>(key: string, fn: () => Promise<T>, options?: LockOptions): Promise<T>;
    /**
     * Cache game state data
     */
    cacheGameState(gameId: string, state: any, ttlSeconds?: number): Promise<void>;
    /**
     * Retrieve cached game state
     */
    getCachedGameState<T = any>(gameId: string): Promise<T | null>;
    /**
     * Store active chunk data
     */
    setActiveChunks(gameId: string, chunkIds: string[]): Promise<void>;
    /**
     * Get active chunks for a game
     */
    getActiveChunks(gameId: string): Promise<string[]>;
    /**
     * Clean up expired game data
     */
    cleanupGame(gameId: string): Promise<void>;
    /**
     * Get connection statistics
     */
    getStats(): {
        subscribedChannels: number;
        subscribedPatterns: number;
        isConnected: boolean;
    };
    /**
     * Shutdown all Redis connections gracefully
     */
    shutdown(): Promise<void>;
    private setupRedisClients;
    private setupEventHandlers;
    private handleMessage;
    private handlePatternMessage;
    private getGameChannel;
    private getChunkChannel;
    private getChunkPattern;
}
/**
 * Message handler type for pub/sub events
 */
export type MessageHandler = (channel: string, message: GameMessage, pattern?: string) => void;
//# sourceMappingURL=PubSubManager.d.ts.map