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
export class ChunkUpdater {
  private socketManager: SocketManager;
  private pubSubManager: PubSubManager;
  private chunkSize: number;
  private subscriptions: Map<string, ChunkSubscription> = new Map(); // socketId -> subscription
  private activeChunks: Map<string, Set<string>> = new Map(); // gameId -> chunkIds
  private updateSequence: Map<string, number> = new Map(); // gameId -> sequence

  constructor(
    socketManager: SocketManager,
    pubSubManager: PubSubManager,
    chunkSize: number = 64
  ) {
    this.socketManager = socketManager;
    this.pubSubManager = pubSubManager;
    this.chunkSize = chunkSize;

    this.setupPubSubHandlers();
  }

  /**
   * Subscribe a client to chunks within their viewport
   */
  async subscribeToViewport(
    socketId: string,
    gameId: string,
    viewport: ViewportBounds
  ): Promise<string[]> {
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
    
    const gameActiveChunks = this.activeChunks.get(gameId)!;
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
  async publishChunkUpdate(gameId: string, changes: CellChange[]): Promise<void> {
    if (changes.length === 0) return;

    // Group changes by chunk
    const chunkUpdates = this.groupChangesByChunk(changes);
    const sequence = this.getNextSequence(gameId);

    // Publish to each affected chunk
    for (const [chunkId, chunkChanges] of chunkUpdates) {
      const update: ChunkUpdate = {
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
  getSubscriptionStats(gameId?: string): {
    totalSubscriptions: number;
    activeChunks: number;
    gamesWithChunks: number;
    subscriptionsByGame?: Map<string, number>;
  } {
    const stats = {
      totalSubscriptions: this.subscriptions.size,
      activeChunks: 0,
      gamesWithChunks: this.activeChunks.size,
      subscriptionsByGame: new Map<string, number>()
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
  async cleanupClient(socketId: string): Promise<void> {
    const subscription = this.subscriptions.get(socketId);
    if (!subscription) return;

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
  calculateVisibleChunks(viewport: ViewportBounds): string[] {
    const { minX, maxX, minY, maxY } = viewport;
    
    const startChunkX = Math.floor(minX / this.chunkSize);
    const endChunkX = Math.floor(maxX / this.chunkSize);
    const startChunkY = Math.floor(minY / this.chunkSize);
    const endChunkY = Math.floor(maxY / this.chunkSize);

    const chunks: string[] = [];
    
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
  getChunkId(x: number, y: number): string {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkY = Math.floor(y / this.chunkSize);
    return `${chunkX},${chunkY}`;
  }

  /**
   * Get all cells within a chunk
   */
  getChunkBounds(chunkId: string): ViewportBounds {
    const [chunkX, chunkY] = chunkId.split(',').map(Number);
    
    return {
      minX: chunkX * this.chunkSize,
      maxX: (chunkX + 1) * this.chunkSize - 1,
      minY: chunkY * this.chunkSize,
      maxY: (chunkY + 1) * this.chunkSize - 1
    };
  }

  private async subscribeToChunk(socketId: string, gameId: string, chunkId: string): Promise<void> {
    // This would be handled by the SocketManager's chunk subscription
    // We just need to track it here for management
  }

  private async unsubscribeFromChunk(socketId: string, gameId: string, chunkId: string): Promise<void> {
    // This would be handled by the SocketManager's chunk unsubscription
    // We just need to track it here for management
  }

  private hasChunkSubscribers(gameId: string, chunkId: string): boolean {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.gameId === gameId && subscription.chunkIds.has(chunkId)) {
        return true;
      }
    }
    return false;
  }

  private groupChangesByChunk(changes: CellChange[]): Map<string, CellChange[]> {
    const chunkUpdates = new Map<string, CellChange[]>();

    for (const change of changes) {
      const chunkId = this.getChunkId(change.x, change.y);
      
      if (!chunkUpdates.has(chunkId)) {
        chunkUpdates.set(chunkId, []);
      }
      
      chunkUpdates.get(chunkId)!.push(change);
    }

    return chunkUpdates;
  }

  private getNextSequence(gameId: string): number {
    const current = this.updateSequence.get(gameId) || 0;
    const next = current + 1;
    this.updateSequence.set(gameId, next);
    return next;
  }

  private setupPubSubHandlers(): void {
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
  shutdown(): void {
    this.subscriptions.clear();
    this.activeChunks.clear();
    this.updateSequence.clear();
    console.log('ChunkUpdater shut down gracefully');
  }
}

/**
 * Viewport calculation utilities
 */
export class ViewportUtils {
  /**
   * Calculate viewport bounds from center point and dimensions
   */
  static fromCenter(
    centerX: number,
    centerY: number,
    width: number,
    height: number
  ): ViewportBounds {
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
  static expandBounds(bounds: ViewportBounds, buffer: number): ViewportBounds {
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
  static intersects(bounds1: ViewportBounds, bounds2: ViewportBounds): boolean {
    return !(bounds1.maxX < bounds2.minX || 
             bounds1.minX > bounds2.maxX || 
             bounds1.maxY < bounds2.minY || 
             bounds1.minY > bounds2.maxY);
  }

  /**
   * Calculate the area of a viewport in cells
   */
  static getArea(bounds: ViewportBounds): number {
    return (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1);
  }
}