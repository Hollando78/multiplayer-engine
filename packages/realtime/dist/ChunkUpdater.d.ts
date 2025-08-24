/**
 * Universal chunk subscription and update system for efficient grid game synchronization
 * Extracted from Territory Conquest's chunk-based rendering optimization
 */
import { SocketManager } from './SocketManager';
import { PubSubManager } from './PubSubManager';
export interface ChunkUpdate {
    gameId: string;
    chunkId: string;
    changes: CellChange[];
    timestamp: Date;
    sequence?: number;
}
export interface CellChange {
    x: number;
    y: number;
    oldValue?: any;
    newValue: any;
    playerId?: string;
}
export interface ViewportBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}
export interface ChunkSubscription {
    socketId: string;
    gameId: string;
    chunkIds: Set<string>;
    lastUpdate: Date;
}
/**
 * Manages chunk-based updates for efficient large-scale multiplayer games
 */
export declare class ChunkUpdater {
    private socketManager;
    private pubSubManager;
    private chunkSize;
    private subscriptions;
    private activeChunks;
    private updateSequence;
    constructor(socketManager: SocketManager, pubSubManager: PubSubManager, chunkSize?: number);
    /**
     * Subscribe a client to chunks within their viewport
     */
    subscribeToViewport(socketId: string, gameId: string, viewport: ViewportBounds): Promise<string[]>;
    /**
     * Publish chunk updates to subscribers
     */
    publishChunkUpdate(gameId: string, changes: CellChange[]): Promise<void>;
    /**
     * Get current chunk subscription statistics
     */
    getSubscriptionStats(gameId?: string): {
        totalSubscriptions: number;
        activeChunks: number;
        gamesWithChunks: number;
        subscriptionsByGame?: Map<string, number>;
    };
    /**
     * Clean up subscriptions for a disconnected client
     */
    cleanupClient(socketId: string): Promise<void>;
    /**
     * Calculate visible chunks for a viewport
     */
    calculateVisibleChunks(viewport: ViewportBounds): string[];
    /**
     * Get chunk coordinates for a world position
     */
    getChunkId(x: number, y: number): string;
    /**
     * Get all cells within a chunk
     */
    getChunkBounds(chunkId: string): ViewportBounds;
    private subscribeToChunk;
    private unsubscribeFromChunk;
    private hasChunkSubscribers;
    private groupChangesByChunk;
    private getNextSequence;
    private setupPubSubHandlers;
    /**
     * Shutdown the chunk updater
     */
    shutdown(): void;
}
/**
 * Viewport calculation utilities
 */
export declare class ViewportUtils {
    /**
     * Calculate viewport bounds from center point and dimensions
     */
    static fromCenter(centerX: number, centerY: number, width: number, height: number): ViewportBounds;
    /**
     * Expand viewport bounds by a buffer amount
     */
    static expandBounds(bounds: ViewportBounds, buffer: number): ViewportBounds;
    /**
     * Check if two viewports intersect
     */
    static intersects(bounds1: ViewportBounds, bounds2: ViewportBounds): boolean;
    /**
     * Calculate the area of a viewport in cells
     */
    static getArea(bounds: ViewportBounds): number;
}
//# sourceMappingURL=ChunkUpdater.d.ts.map