"use strict";
/**
 * Universal chunk subscription and update system for efficient grid game synchronization
 * Extracted from Territory Conquest's chunk-based rendering optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewportUtils = exports.ChunkUpdater = void 0;
/**
 * Manages chunk-based updates for efficient large-scale multiplayer games
 */
class ChunkUpdater {
    socketManager;
    pubSubManager;
    chunkSize;
    subscriptions = new Map(); // socketId -> subscription
    activeChunks = new Map(); // gameId -> chunkIds
    updateSequence = new Map(); // gameId -> sequence
    constructor(socketManager, pubSubManager, chunkSize = 64) {
        this.socketManager = socketManager;
        this.pubSubManager = pubSubManager;
        this.chunkSize = chunkSize;
        this.setupPubSubHandlers();
    }
    /**
     * Subscribe a client to chunks within their viewport
     */
    async subscribeToViewport(socketId, gameId, viewport) {
        const chunkIds = this.calculateVisibleChunks(viewport);
        // Get current subscription or create new one
        let subscription = this.subscriptions.get(socketId);
        if (!subscription) {
            subscription = {
                socketId,
                gameId,
                chunkIds: new Set(),
                lastUpdate: new Date()
            };
            this.subscriptions.set(socketId, subscription);
        }
        // Calculate chunks to add and remove
        const currentChunks = subscription.chunkIds;
        const newChunks = new Set(chunkIds);
        const chunksToAdd = chunkIds.filter(id => !currentChunks.has(id));
        const chunksToRemove = Array.from(currentChunks).filter(id => !newChunks.has(id));
        // Update subscription
        subscription.chunkIds = newChunks;
        subscription.lastUpdate = new Date();
        // Subscribe to new chunks
        for (const chunkId of chunksToAdd) {
            await this.subscribeToChunk(socketId, gameId, chunkId);
        }
        // Unsubscribe from old chunks
        for (const chunkId of chunksToRemove) {
            await this.unsubscribeFromChunk(socketId, gameId, chunkId);
        }
        // Track active chunks for this game
        if (!this.activeChunks.has(gameId)) {
            this.activeChunks.set(gameId, new Set());
        }
        const gameActiveChunks = this.activeChunks.get(gameId);
        chunksToAdd.forEach(id => gameActiveChunks.add(id));
        // Clean up inactive chunks (if no subscribers)
        for (const chunkId of chunksToRemove) {
            if (!this.hasChunkSubscribers(gameId, chunkId)) {
                gameActiveChunks.delete(chunkId);
            }
        }
        // Update Redis cache
        await this.pubSubManager.setActiveChunks(gameId, Array.from(gameActiveChunks));
        console.log(`Socket ${socketId} subscribed to ${chunksToAdd.length} new chunks, unsubscribed from ${chunksToRemove.length} chunks`);
        return chunkIds;
    }
    /**
     * Publish chunk updates to subscribers
     */
    async publishChunkUpdate(gameId, changes) {
        if (changes.length === 0)
            return;
        // Group changes by chunk
        const chunkUpdates = this.groupChangesByChunk(changes);
        const sequence = this.getNextSequence(gameId);
        // Publish to each affected chunk
        for (const [chunkId, chunkChanges] of chunkUpdates) {
            const update = {
                gameId,
                chunkId,
                changes: chunkChanges,
                timestamp: new Date(),
                sequence
            };
            // Publish via Redis for distributed systems
            await this.pubSubManager.publishChunkUpdate(gameId, chunkId, update);
            // Also send directly via WebSocket for immediate local updates
            this.socketManager.handleChunkUpdate(gameId, chunkId, update);
        }
        console.log(`Published updates to ${chunkUpdates.size} chunks for game ${gameId}`);
    }
    /**
     * Get current chunk subscription statistics
     */
    getSubscriptionStats(gameId) {
        const stats = {
            totalSubscriptions: this.subscriptions.size,
            activeChunks: 0,
            gamesWithChunks: this.activeChunks.size,
            subscriptionsByGame: new Map()
        };
        // Count active chunks
        for (const chunks of this.activeChunks.values()) {
            stats.activeChunks += chunks.size;
        }
        // Count subscriptions by game
        for (const subscription of this.subscriptions.values()) {
            const gameId = subscription.gameId;
            const currentCount = stats.subscriptionsByGame.get(gameId) || 0;
            stats.subscriptionsByGame.set(gameId, currentCount + 1);
        }
        return stats;
    }
    /**
     * Clean up subscriptions for a disconnected client
     */
    async cleanupClient(socketId) {
        const subscription = this.subscriptions.get(socketId);
        if (!subscription)
            return;
        const { gameId, chunkIds } = subscription;
        // Unsubscribe from all chunks
        for (const chunkId of chunkIds) {
            await this.unsubscribeFromChunk(socketId, gameId, chunkId);
        }
        // Remove subscription
        this.subscriptions.delete(socketId);
        // Clean up inactive chunks
        const gameActiveChunks = this.activeChunks.get(gameId);
        if (gameActiveChunks) {
            for (const chunkId of chunkIds) {
                if (!this.hasChunkSubscribers(gameId, chunkId)) {
                    gameActiveChunks.delete(chunkId);
                }
            }
            // Update Redis cache
            await this.pubSubManager.setActiveChunks(gameId, Array.from(gameActiveChunks));
        }
        console.log(`Cleaned up subscriptions for socket ${socketId}`);
    }
    /**
     * Calculate visible chunks for a viewport
     */
    calculateVisibleChunks(viewport) {
        const { minX, maxX, minY, maxY } = viewport;
        const startChunkX = Math.floor(minX / this.chunkSize);
        const endChunkX = Math.floor(maxX / this.chunkSize);
        const startChunkY = Math.floor(minY / this.chunkSize);
        const endChunkY = Math.floor(maxY / this.chunkSize);
        const chunks = [];
        for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
            for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY++) {
                chunks.push(`${chunkX},${chunkY}`);
            }
        }
        return chunks;
    }
    /**
     * Get chunk coordinates for a world position
     */
    getChunkId(x, y) {
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        return `${chunkX},${chunkY}`;
    }
    /**
     * Get all cells within a chunk
     */
    getChunkBounds(chunkId) {
        const [chunkX, chunkY] = chunkId.split(',').map(Number);
        return {
            minX: chunkX * this.chunkSize,
            maxX: (chunkX + 1) * this.chunkSize - 1,
            minY: chunkY * this.chunkSize,
            maxY: (chunkY + 1) * this.chunkSize - 1
        };
    }
    async subscribeToChunk(socketId, gameId, chunkId) {
        // This would be handled by the SocketManager's chunk subscription
        // We just need to track it here for management
    }
    async unsubscribeFromChunk(socketId, gameId, chunkId) {
        // This would be handled by the SocketManager's chunk unsubscription
        // We just need to track it here for management
    }
    hasChunkSubscribers(gameId, chunkId) {
        for (const subscription of this.subscriptions.values()) {
            if (subscription.gameId === gameId && subscription.chunkIds.has(chunkId)) {
                return true;
            }
        }
        return false;
    }
    groupChangesByChunk(changes) {
        const chunkUpdates = new Map();
        for (const change of changes) {
            const chunkId = this.getChunkId(change.x, change.y);
            if (!chunkUpdates.has(chunkId)) {
                chunkUpdates.set(chunkId, []);
            }
            chunkUpdates.get(chunkId).push(change);
        }
        return chunkUpdates;
    }
    getNextSequence(gameId) {
        const current = this.updateSequence.get(gameId) || 0;
        const next = current + 1;
        this.updateSequence.set(gameId, next);
        return next;
    }
    setupPubSubHandlers() {
        // Subscribe to all chunk updates for processing
        this.pubSubManager.subscribeToAllGames((channel, message) => {
            if (message.type === 'chunk-update' && message.chunkId) {
                // Forward chunk updates received via Redis to local WebSocket clients
                this.socketManager.handleChunkUpdate(message.gameId, message.chunkId, message.data);
            }
        });
    }
    /**
     * Shutdown the chunk updater
     */
    shutdown() {
        this.subscriptions.clear();
        this.activeChunks.clear();
        this.updateSequence.clear();
        console.log('ChunkUpdater shut down gracefully');
    }
}
exports.ChunkUpdater = ChunkUpdater;
/**
 * Viewport calculation utilities
 */
class ViewportUtils {
    /**
     * Calculate viewport bounds from center point and dimensions
     */
    static fromCenter(centerX, centerY, width, height) {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        return {
            minX: Math.floor(centerX - halfWidth),
            maxX: Math.ceil(centerX + halfWidth),
            minY: Math.floor(centerY - halfHeight),
            maxY: Math.ceil(centerY + halfHeight)
        };
    }
    /**
     * Expand viewport bounds by a buffer amount
     */
    static expandBounds(bounds, buffer) {
        return {
            minX: bounds.minX - buffer,
            maxX: bounds.maxX + buffer,
            minY: bounds.minY - buffer,
            maxY: bounds.maxY + buffer
        };
    }
    /**
     * Check if two viewports intersect
     */
    static intersects(bounds1, bounds2) {
        return !(bounds1.maxX < bounds2.minX ||
            bounds1.minX > bounds2.maxX ||
            bounds1.maxY < bounds2.minY ||
            bounds1.minY > bounds2.maxY);
    }
    /**
     * Calculate the area of a viewport in cells
     */
    static getArea(bounds) {
        return (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
    }
}
exports.ViewportUtils = ViewportUtils;
//# sourceMappingURL=ChunkUpdater.js.map