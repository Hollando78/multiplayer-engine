/**
 * Conway's Game of Life multiplayer server demonstrating full real-time integration
 * Shows how to use all real-time components together: SocketManager, PubSubManager, ChunkUpdater, StateSync
 */
/**
 * Initialize the server with full real-time multiplayer infrastructure
 */
declare function initializeServer(): Promise<void>;
export { initializeServer };
