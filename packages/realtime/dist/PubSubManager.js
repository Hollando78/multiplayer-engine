"use strict";
/**
 * Universal Redis pub/sub manager for distributed multiplayer games
 * Extracted from Territory Conquest's Redis infrastructure
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubSubManager = void 0;
const ioredis_1 = require("ioredis");
/**
 * Universal Redis pub/sub manager for multiplayer games
 */
class PubSubManager {
    redis;
    pubClient;
    subClient;
    config;
    messageHandlers = new Map();
    patternHandlers = new Map();
    constructor(config = {}) {
        this.config = {
            redisUrl: 'redis://localhost:6379',
            retryStrategy: (times) => Math.min(times * 50, 2000),
            maxRetriesPerRequest: 3,
            keyPrefix: 'game:',
            ...config
        };
        this.setupRedisClients();
        this.setupEventHandlers();
    }
    /**
     * Publish a game update to all subscribers
     */
    async publishGameUpdate(gameId, message) {
        const channel = this.getGameChannel(gameId);
        const fullMessage = {
            gameId,
            timestamp: new Date(),
            ...message
        };
        return await this.pubClient.publish(channel, JSON.stringify(fullMessage));
    }
    /**
     * Publish a chunk-specific update
     */
    async publishChunkUpdate(gameId, chunkId, data) {
        const channel = this.getChunkChannel(gameId, chunkId);
        const message = {
            gameId,
            chunkId,
            type: 'chunk-update',
            data,
            timestamp: new Date()
        };
        return await this.pubClient.publish(channel, JSON.stringify(message));
    }
    /**
     * Publish player event (join/leave/move)
     */
    async publishPlayerEvent(gameId, playerId, event, data = {}) {
        return await this.publishGameUpdate(gameId, {
            type: 'player-event',
            playerId,
            data: { event, ...data }
        });
    }
    /**
     * Subscribe to all updates for a specific game
     */
    async subscribeToGame(gameId, handler) {
        const channel = this.getGameChannel(gameId);
        if (!this.messageHandlers.has(channel)) {
            this.messageHandlers.set(channel, []);
            await this.subClient.subscribe(channel);
        }
        this.messageHandlers.get(channel).push(handler);
    }
    /**
     * Subscribe to chunk updates for a specific game
     */
    async subscribeToGameChunks(gameId, handler) {
        const pattern = this.getChunkPattern(gameId);
        if (!this.patternHandlers.has(pattern)) {
            this.patternHandlers.set(pattern, []);
            await this.subClient.psubscribe(pattern);
        }
        this.patternHandlers.get(pattern).push(handler);
    }
    /**
     * Subscribe to all game updates using pattern matching
     */
    async subscribeToAllGames(handler) {
        const pattern = `${this.config.keyPrefix}*`;
        if (!this.patternHandlers.has(pattern)) {
            this.patternHandlers.set(pattern, []);
            await this.subClient.psubscribe(pattern);
        }
        this.patternHandlers.get(pattern).push(handler);
    }
    /**
     * Unsubscribe from a specific game
     */
    async unsubscribeFromGame(gameId, handler) {
        const channel = this.getGameChannel(gameId);
        const handlers = this.messageHandlers.get(channel);
        if (!handlers)
            return;
        if (handler) {
            // Remove specific handler
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
        else {
            // Remove all handlers
            handlers.length = 0;
        }
        // Unsubscribe from Redis if no handlers left
        if (handlers.length === 0) {
            await this.subClient.unsubscribe(channel);
            this.messageHandlers.delete(channel);
        }
    }
    /**
     * Acquire a distributed lock for coordinated operations
     */
    async acquireLock(key, options = {}) {
        const { ttlSeconds = 5, maxRetries = 3, retryDelay = 100 } = options;
        const lockKey = `lock:${key}`;
        const lockId = Math.random().toString(36).substring(7);
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const acquired = await this.redis.set(lockKey, lockId, 'EX', ttlSeconds, 'NX');
            if (acquired === 'OK') {
                return {
                    acquired: true,
                    lockId,
                    release: async () => {
                        const currentLock = await this.redis.get(lockKey);
                        if (currentLock === lockId) {
                            await this.redis.del(lockKey);
                        }
                    }
                };
            }
            // Wait before retry
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
            }
        }
        return { acquired: false };
    }
    /**
     * Execute function with distributed lock
     */
    async withLock(key, fn, options = {}) {
        const lock = await this.acquireLock(key, options);
        if (!lock.acquired) {
            throw new Error(`Failed to acquire lock for ${key}`);
        }
        try {
            return await fn();
        }
        finally {
            if (lock.release) {
                await lock.release();
            }
        }
    }
    /**
     * Cache game state data
     */
    async cacheGameState(gameId, state, ttlSeconds = 300) {
        const key = `state:${gameId}`;
        await this.redis.setex(key, ttlSeconds, JSON.stringify(state));
    }
    /**
     * Retrieve cached game state
     */
    async getCachedGameState(gameId) {
        const key = `state:${gameId}`;
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    /**
     * Store active chunk data
     */
    async setActiveChunks(gameId, chunkIds) {
        const key = `chunks:${gameId}`;
        if (chunkIds.length > 0) {
            await this.redis.sadd(key, ...chunkIds);
            await this.redis.expire(key, 300); // 5 minute expiry
        }
        else {
            await this.redis.del(key);
        }
    }
    /**
     * Get active chunks for a game
     */
    async getActiveChunks(gameId) {
        const key = `chunks:${gameId}`;
        return await this.redis.smembers(key);
    }
    /**
     * Clean up expired game data
     */
    async cleanupGame(gameId) {
        const keys = [
            `state:${gameId}`,
            `chunks:${gameId}`,
            `lock:${gameId}:*`
        ];
        // Use pipeline for efficient cleanup
        const pipeline = this.redis.pipeline();
        keys.forEach(pattern => {
            if (pattern.includes('*')) {
                // Note: In production, use SCAN instead of KEYS for better performance
                this.redis.keys(pattern).then(matchedKeys => {
                    matchedKeys.forEach(key => pipeline.del(key));
                });
            }
            else {
                pipeline.del(pattern);
            }
        });
        await pipeline.exec();
    }
    /**
     * Get connection statistics
     */
    getStats() {
        return {
            subscribedChannels: this.messageHandlers.size,
            subscribedPatterns: this.patternHandlers.size,
            isConnected: this.redis.status === 'ready'
        };
    }
    /**
     * Shutdown all Redis connections gracefully
     */
    async shutdown() {
        console.log('Shutting down PubSubManager...');
        // Clear all handlers
        this.messageHandlers.clear();
        this.patternHandlers.clear();
        // Close connections
        await Promise.all([
            this.redis.quit(),
            this.pubClient.quit(),
            this.subClient.quit()
        ]);
        console.log('PubSubManager shut down gracefully');
    }
    setupRedisClients() {
        const redisOptions = {
            retryStrategy: this.config.retryStrategy,
            maxRetriesPerRequest: this.config.maxRetriesPerRequest
        };
        this.redis = new ioredis_1.default(this.config.redisUrl, redisOptions);
        this.pubClient = new ioredis_1.default(this.config.redisUrl, redisOptions);
        this.subClient = new ioredis_1.default(this.config.redisUrl, redisOptions);
    }
    setupEventHandlers() {
        // Main Redis client events
        this.redis.on('error', (err) => {
            console.error('Redis connection error:', err);
        });
        this.redis.on('connect', () => {
            console.log('Redis connected successfully');
        });
        // Subscriber client message handling
        this.subClient.on('message', (channel, message) => {
            this.handleMessage(channel, message);
        });
        this.subClient.on('pmessage', (pattern, channel, message) => {
            this.handlePatternMessage(pattern, channel, message);
        });
        this.subClient.on('error', (error) => {
            console.error('Redis subscriber error:', error);
        });
    }
    handleMessage(channel, message) {
        const handlers = this.messageHandlers.get(channel);
        if (!handlers)
            return;
        try {
            const parsedMessage = JSON.parse(message);
            handlers.forEach(handler => {
                try {
                    handler(channel, parsedMessage);
                }
                catch (error) {
                    console.error('Error in message handler:', error);
                }
            });
        }
        catch (error) {
            console.error('Error parsing Redis message:', error);
        }
    }
    handlePatternMessage(pattern, channel, message) {
        const handlers = this.patternHandlers.get(pattern);
        if (!handlers)
            return;
        try {
            const parsedMessage = JSON.parse(message);
            handlers.forEach(handler => {
                try {
                    handler(channel, parsedMessage, pattern);
                }
                catch (error) {
                    console.error('Error in pattern message handler:', error);
                }
            });
        }
        catch (error) {
            console.error('Error parsing Redis pattern message:', error);
        }
    }
    getGameChannel(gameId) {
        return `${this.config.keyPrefix}${gameId}`;
    }
    getChunkChannel(gameId, chunkId) {
        return `${this.config.keyPrefix}${gameId}:chunk:${chunkId}`;
    }
    getChunkPattern(gameId) {
        return `${this.config.keyPrefix}${gameId}:chunk:*`;
    }
}
exports.PubSubManager = PubSubManager;
//# sourceMappingURL=PubSubManager.js.map