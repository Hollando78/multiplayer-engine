/**
 * @multiplayer-engine/realtime
 * 
 * Real-time multiplayer infrastructure with WebSocket and Redis pub/sub.
 * Provides chunk-based updates, optimistic synchronization, and distributed state management.
 * Extracted from Territory Conquest's real-time multiplayer systems.
 */

// Server-side components
export { 
  SocketManager, 
  defaultSocketConfig,
  type SocketConfig,
  type GameUpdate,
  type ChunkSubscription,
  type GameSocketHandler
} from './SocketManager';

export { 
  PubSubManager,
  type PubSubConfig,
  type GameMessage,
  type LockOptions,
  type LockResult,
  type MessageHandler
} from './PubSubManager';

export { 
  ChunkUpdater,
  ViewportUtils,
  type ChunkUpdate,
  type CellChange,
  type ViewportBounds
} from './ChunkUpdater';

export { 
  StateSync,
  type OptimisticUpdate,
  type StateConflict,
  type SyncConfig,
  type StateUpdateHandler
} from './StateSync';

// Client-side components
export { 
  SocketClient,
  defaultClientConfig,
  type ClientConfig,
  type GameEventData,
  type ChunkUpdateData
} from './SocketClient';