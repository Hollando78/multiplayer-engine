/**
 * Client-side demo for Conway's Game of Life multiplayer integration
 * Demonstrates real-time synchronization, chunk subscriptions, and optimistic updates
 */
/**
 * Conway's Life client with real-time multiplayer features
 */
declare class ConwayLifeClient {
    private socketClient;
    private gameId;
    private playerId;
    private gameState;
    private liveCells;
    private currentViewport;
    constructor(serverUrl?: string);
    /**
     * Connect to the server and initialize
     */
    connect(): Promise<void>;
    /**
     * Create a new game
     */
    createGame(): Promise<string>;
    /**
     * Join an existing game
     */
    joinGame(gameId: string): Promise<void>;
    /**
     * Place a cell at the specified coordinates
     */
    placeCell(x: number, y: number): Promise<void>;
    /**
     * Place a common Conway's Life pattern
     */
    placePattern(pattern: string, x: number, y: number): Promise<void>;
    /**
     * Change simulation speed
     */
    setSpeed(speed: number): Promise<void>;
    /**
     * Update viewport for chunk subscriptions
     */
    private updateViewport;
    /**
     * Setup event handlers for real-time updates
     */
    private setupEventHandlers;
    /**
     * Display the current grid state (simplified console visualization)
     */
    private displayGrid;
    /**
     * Get current game statistics
     */
    getStats(): any;
    /**
     * Disconnect from the game
     */
    disconnect(): Promise<void>;
}
/**
 * Interactive demo showing real-time multiplayer Conway's Life
 */
declare function runDemo(): Promise<void>;
export { ConwayLifeClient, runDemo };
