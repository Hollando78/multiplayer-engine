/**
 * Universal SocketManager for real-time multiplayer games
 * Extracted from Territory Conquest's WebSocket implementation
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { GameStateUpdate } from '@multiplayer-engine/core';

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
export class SocketManager {
  private io: SocketIOServer;
  private gameHandlers: Map<string, GameSocketHandler> = new Map();
  private chunkSubscriptions: Map<string, Set<string>> = new Map(); // socketId -> chunkIds

  constructor(httpServer: HTTPServer, config: SocketConfig) {
    this.io = new SocketIOServer(httpServer, config);
    this.setupConnectionHandling();
  }

  /**
   * Register a game-specific socket handler
   */
  registerGameHandler(gameType: string, handler: GameSocketHandler): void {
    this.gameHandlers.set(gameType, handler);
  }

  /**
   * Broadcast update to all players in a game
   */
  broadcastToGame(gameId: string, event: string, data: any): void {
    this.io.to(`game:${gameId}`).emit(event, data);
  }

  /**
   * Broadcast update to specific chunk subscribers
   */
  broadcastToChunk(gameId: string, chunkId: string, event: string, data: any): void {
    const room = `game:${gameId}:chunk:${chunkId}`;
    this.io.to(room).emit(event, data);
  }

  /**
   * Send update to specific socket
   */
  sendToSocket(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Handle game move broadcast
   */
  handleGameMove(gameUpdate: GameUpdate): void {
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
  handleChunkUpdate(gameId: string, chunkId: string, data: any): void {
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
  getGamePlayerCount(gameId: string): number {
    const room = this.io.sockets.adapter.rooms.get(`game:${gameId}`);
    return room ? room.size : 0;
  }

  /**
   * Get all active chunk subscriptions for a game
   */
  getActiveChunks(gameId: string): string[] {
    const chunks = new Set<string>();
    
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
  private setupConnectionHandling(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log('User connected:', socket.id);

      // Store socket metadata
      socket.data = {
        joinedGames: new Set<string>(),
        subscribedChunks: new Set<string>()
      };

      // Game room management
      socket.on('join-game', (data: { gameId: string; gameType?: string }) => {
        this.handleJoinGame(socket, data);
      });

      socket.on('leave-game', (gameId: string) => {
        this.handleLeaveGame(socket, gameId);
      });

      // Chunk subscription management
      socket.on('subscribe-chunk', (data: ChunkSubscription) => {
        this.handleSubscribeChunk(socket, data);
      });

      socket.on('unsubscribe-chunk', (data: ChunkSubscription) => {
        this.handleUnsubscribeChunk(socket, data);
      });

      // Game-specific events
      socket.on('game-move', (data: any) => {
        this.handleSocketGameMove(socket, data);
      });

      socket.on('game-state-change', (data: any) => {
        this.handleSocketStateChange(socket, data);
      });

      // Connection cleanup
      socket.on('disconnect', (reason: string) => {
        this.handleDisconnect(socket, reason);
      });

      socket.on('error', (error: Error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  private handleJoinGame(socket: Socket, { gameId, gameType }: { gameId: string; gameType?: string }): void {
    try {
      socket.join(`game:${gameId}`);
      socket.data.joinedGames.add(gameId);
      
      console.log(`Socket ${socket.id} joined game ${gameId}`);

      // Notify game-specific handler
      if (gameType && this.gameHandlers.has(gameType)) {
        const handler = this.gameHandlers.get(gameType)!;
        handler.onPlayerJoined?.(socket, gameId);
      }

      // Broadcast to other players in the game
      socket.to(`game:${gameId}`).emit('player-connected', {
        socketId: socket.id,
        gameId,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('error', { type: 'join-game-failed', error: (error as Error).message });
    }
  }

  private handleLeaveGame(socket: Socket, gameId: string): void {
    try {
      socket.leave(`game:${gameId}`);
      socket.data.joinedGames.delete(gameId);

      console.log(`Socket ${socket.id} left game ${gameId}`);

      // Clean up chunk subscriptions for this game
      const chunksToRemove: string[] = [];
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

    } catch (error) {
      console.error('Error leaving game:', error);
    }
  }

  private handleSubscribeChunk(socket: Socket, { gameId, chunkId }: ChunkSubscription): void {
    try {
      const room = `game:${gameId}:chunk:${chunkId}`;
      socket.join(room);
      socket.data.subscribedChunks.add(room);
      
      console.log(`Socket ${socket.id} subscribed to chunk ${chunkId} in game ${gameId}`);

    } catch (error) {
      console.error('Error subscribing to chunk:', error);
    }
  }

  private handleUnsubscribeChunk(socket: Socket, { gameId, chunkId }: ChunkSubscription): void {
    try {
      const room = `game:${gameId}:chunk:${chunkId}`;
      socket.leave(room);
      socket.data.subscribedChunks.delete(room);

    } catch (error) {
      console.error('Error unsubscribing from chunk:', error);
    }
  }

  private handleSocketGameMove(socket: Socket, data: any): void {
    try {
      // Broadcast to other players in the game (not sender)
      socket.to(`game:${data.gameId}`).emit('move-made', {
        ...data,
        socketId: socket.id,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error broadcasting game move:', error);
    }
  }

  private handleSocketStateChange(socket: Socket, data: any): void {
    try {
      socket.to(`game:${data.gameId}`).emit('state-updated', {
        ...data,
        socketId: socket.id,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error broadcasting state change:', error);
    }
  }

  private handleDisconnect(socket: Socket, reason: string): void {
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
  shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        console.log('SocketManager shut down gracefully');
        resolve();
      });
    });
  }
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
export const defaultSocketConfig: SocketConfig = {
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