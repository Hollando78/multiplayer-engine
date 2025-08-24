/**
 * Universal client-side socket manager for connecting to multiplayer games
 * Provides high-level API for game clients to interact with real-time systems
 */

import { io, Socket } from 'socket.io-client';
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
export class SocketClient {
  private socket: Socket;
  private config: ClientConfig;
  private currentGameId: string | null = null;
  private subscribedChunks: Set<string> = new Set();
  private eventHandlers: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: ClientConfig) {
    this.config = config;
    this.socket = this.createSocket();
    this.setupEventHandlers();
  }

  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.options?.timeout || 10000);

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        console.log('Connected to server:', this.socket.id);
        resolve();
      });

      this.socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      if (!this.socket.connected) {
        this.socket.connect();
      } else {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  /**
   * Join a game room
   */
  async joinGame(gameId: string, gameType?: string): Promise<void> {
    if (this.currentGameId) {
      await this.leaveGame();
    }

    this.currentGameId = gameId;
    this.socket.emit('join-game', { gameId, gameType });

    console.log(`Joining game: ${gameId}`);
  }

  /**
   * Leave current game
   */
  async leaveGame(): Promise<void> {
    if (!this.currentGameId) return;

    // Unsubscribe from all chunks
    await this.unsubscribeFromAllChunks();

    // Leave game room
    this.socket.emit('leave-game', this.currentGameId);
    
    console.log(`Left game: ${this.currentGameId}`);
    this.currentGameId = null;
  }

  /**
   * Subscribe to chunks within a viewport
   */
  async subscribeToViewport(viewport: ViewportBounds): Promise<void> {
    if (!this.currentGameId) {
      throw new Error('Must join a game before subscribing to chunks');
    }

    // Calculate visible chunks (this logic could be extracted to a utility)
    const chunkIds = this.calculateVisibleChunks(viewport, 64); // Default chunk size
    
    // Subscribe to new chunks
    const newChunks = chunkIds.filter(id => !this.subscribedChunks.has(id));
    for (const chunkId of newChunks) {
      this.socket.emit('subscribe-chunk', {
        gameId: this.currentGameId,
        chunkId
      });
      this.subscribedChunks.add(chunkId);
    }

    // Unsubscribe from old chunks
    const oldChunks = Array.from(this.subscribedChunks).filter(id => !chunkIds.includes(id));
    for (const chunkId of oldChunks) {
      this.socket.emit('unsubscribe-chunk', {
        gameId: this.currentGameId,
        chunkId
      });
      this.subscribedChunks.delete(chunkId);
    }

    console.log(`Subscribed to ${newChunks.length} new chunks, unsubscribed from ${oldChunks.length} old chunks`);
  }

  /**
   * Send a game move to other players
   */
  sendMove(moveData: any): void {
    if (!this.currentGameId) {
      throw new Error('Must join a game before sending moves');
    }

    this.socket.emit('game-move', {
      gameId: this.currentGameId,
      ...moveData,
      timestamp: new Date()
    });
  }

  /**
   * Send a game state change to other players
   */
  sendStateChange(stateData: any): void {
    if (!this.currentGameId) {
      throw new Error('Must join a game before sending state changes');
    }

    this.socket.emit('game-state-change', {
      gameId: this.currentGameId,
      ...stateData,
      timestamp: new Date()
    });
  }

  /**
   * Listen for specific game events
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler?: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;

    if (handler) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    } else {
      handlers.length = 0;
    }
  }

  /**
   * Listen for move updates from other players
   */
  onMove(handler: (data: GameEventData) => void): void {
    this.on('move-made', handler);
  }

  /**
   * Listen for state updates from other players
   */
  onStateUpdate(handler: (data: GameEventData) => void): void {
    this.on('state-updated', handler);
  }

  /**
   * Listen for chunk updates
   */
  onChunkUpdate(handler: (data: ChunkUpdateData) => void): void {
    this.on('chunk-updated', handler);
  }

  /**
   * Listen for player join/leave events
   */
  onPlayerEvent(handler: (data: { event: string; playerId?: string; data: any }) => void): void {
    this.on('player-joined', handler);
    this.on('player-left', handler);
    this.on('player-connected', handler);
    this.on('player-disconnected', handler);
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket.connected;
  }

  /**
   * Get current game ID
   */
  getCurrentGameId(): string | null {
    return this.currentGameId;
  }

  /**
   * Get subscribed chunks
   */
  getSubscribedChunks(): string[] {
    return Array.from(this.subscribedChunks);
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.currentGameId) {
      this.leaveGame();
    }
    
    this.socket.disconnect();
    console.log('Disconnected from server');
  }

  private createSocket(): Socket {
    const options = {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      ...this.config.options
    };

    return io(this.config.url, options);
  }

  private setupEventHandlers(): void {
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.emit('connected', { socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.emit('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.emit('connection-error', { error });
      
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.emit('max-reconnect-attempts', {});
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emit('error', { error });
    });

    // Game-specific events
    this.socket.on('move-made', (data) => {
      this.emit('move-made', data);
    });

    this.socket.on('state-updated', (data) => {
      this.emit('state-updated', data);
    });

    this.socket.on('chunk-updated', (data) => {
      this.emit('chunk-updated', data);
    });

    this.socket.on('player-joined', (data) => {
      this.emit('player-joined', data);
    });

    this.socket.on('player-left', (data) => {
      this.emit('player-left', data);
    });

    this.socket.on('player-connected', (data) => {
      this.emit('player-connected', data);
    });

    this.socket.on('player-disconnected', (data) => {
      this.emit('player-disconnected', data);
    });
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    });
  }

  private async unsubscribeFromAllChunks(): Promise<void> {
    if (!this.currentGameId) return;

    for (const chunkId of this.subscribedChunks) {
      this.socket.emit('unsubscribe-chunk', {
        gameId: this.currentGameId,
        chunkId
      });
    }

    this.subscribedChunks.clear();
  }

  private calculateVisibleChunks(viewport: ViewportBounds, chunkSize: number): string[] {
    const { minX, maxX, minY, maxY } = viewport;
    
    const startChunkX = Math.floor(minX / chunkSize);
    const endChunkX = Math.floor(maxX / chunkSize);
    const startChunkY = Math.floor(minY / chunkSize);
    const endChunkY = Math.floor(maxY / chunkSize);

    const chunks: string[] = [];
    
    for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
      for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY++) {
        chunks.push(`${chunkX},${chunkY}`);
      }
    }

    return chunks;
  }
}

/**
 * Default client configuration
 */
export const defaultClientConfig: Omit<ClientConfig, 'url'> = {
  options: {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  }
};