"use strict";
/**
 * Client-side demo for Conway's Game of Life multiplayer integration
 * Demonstrates real-time synchronization, chunk subscriptions, and optimistic updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConwayLifeClient = void 0;
exports.runDemo = runDemo;
const realtime_1 = require("@multiplayer-engine/realtime");
/**
 * Conway's Life client with real-time multiplayer features
 */
class ConwayLifeClient {
    socketClient;
    gameId = null;
    playerId;
    gameState = null;
    liveCells = new Map();
    currentViewport = null;
    constructor(serverUrl = 'http://localhost:3000') {
        this.playerId = `player-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        this.socketClient = new realtime_1.SocketClient({
            url: serverUrl,
            options: {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5
            }
        });
        this.setupEventHandlers();
    }
    /**
     * Connect to the server and initialize
     */
    async connect() {
        console.log('🔌 Connecting to Conway\'s Life server...');
        await this.socketClient.connect();
        console.log('✅ Connected to server');
    }
    /**
     * Create a new game
     */
    async createGame() {
        console.log('🎮 Creating new Conway\'s Life game...');
        const response = await fetch('http://localhost:3000/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to create game');
        }
        this.gameId = result.gameId;
        if (!this.gameId) {
            throw new Error('Failed to get gameId from server');
        }
        console.log(`✅ Created game: ${this.gameId}`);
        return this.gameId;
    }
    /**
     * Join an existing game
     */
    async joinGame(gameId) {
        console.log(`🚪 Joining game: ${gameId}...`);
        this.gameId = gameId;
        await this.socketClient.joinGame(gameId, 'conway');
        // Set up viewport for chunk subscriptions (covering a 10x10 area around origin)
        this.currentViewport = realtime_1.ViewportUtils.fromCenter(0, 0, 10, 10);
        await this.updateViewport();
        console.log(`✅ Joined game: ${gameId}`);
    }
    /**
     * Place a cell at the specified coordinates
     */
    async placeCell(x, y) {
        if (!this.gameId) {
            throw new Error('Must join a game first');
        }
        console.log(`📍 Placing cell at (${x}, ${y})...`);
        // Optimistic update - place cell immediately for responsive UI
        const cellKey = `${x},${y}`;
        const optimisticCell = {
            x,
            y,
            alive: true,
            playerId: this.playerId,
            generation: this.gameState?.generation || 0
        };
        this.liveCells.set(cellKey, optimisticCell);
        this.displayGrid(); // Update display immediately
        try {
            // Send to server for authoritative processing
            const response = await fetch(`http://localhost:3000/api/games/${this.gameId}/place`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y, playerId: this.playerId })
            });
            const result = await response.json();
            if (!result.success) {
                // Rollback optimistic update
                this.liveCells.delete(cellKey);
                console.error('❌ Failed to place cell:', result.error);
                this.displayGrid();
            }
            else {
                console.log(`✅ Cell placed successfully at (${x}, ${y})`);
            }
        }
        catch (error) {
            // Rollback optimistic update
            this.liveCells.delete(cellKey);
            console.error('❌ Error placing cell:', error);
            this.displayGrid();
        }
    }
    /**
     * Place a common Conway's Life pattern
     */
    async placePattern(pattern, x, y) {
        if (!this.gameId) {
            throw new Error('Must join a game first');
        }
        console.log(`🎨 Placing ${pattern} pattern at (${x}, ${y})...`);
        this.socketClient.sendStateChange({
            type: 'place-pattern',
            pattern,
            x,
            y,
            playerId: this.playerId
        });
    }
    /**
     * Change simulation speed
     */
    async setSpeed(speed) {
        if (!this.gameId) {
            throw new Error('Must join a game first');
        }
        console.log(`⚡ Setting speed to ${speed}ms per generation...`);
        this.socketClient.sendStateChange({
            type: 'set-speed',
            speed,
            playerId: this.playerId
        });
    }
    /**
     * Update viewport for chunk subscriptions
     */
    async updateViewport() {
        if (!this.currentViewport || !this.gameId)
            return;
        // Expand viewport slightly for better coverage
        const expandedViewport = realtime_1.ViewportUtils.expandBounds(this.currentViewport, 2);
        await this.socketClient.subscribeToViewport(expandedViewport);
        console.log(`🔲 Updated viewport subscription:`, expandedViewport);
    }
    /**
     * Setup event handlers for real-time updates
     */
    setupEventHandlers() {
        // Connection events
        this.socketClient.on('connected', (data) => {
            console.log('🔗 WebSocket connected:', data.socketId);
        });
        this.socketClient.on('disconnected', (data) => {
            console.log('❌ WebSocket disconnected:', data.reason);
        });
        this.socketClient.on('error', (data) => {
            console.error('🚨 WebSocket error:', data.error);
        });
        // Game initialization
        this.socketClient.on('game-initialized', (data) => {
            console.log('🎮 Game initialized with state:', data.gameState);
            this.gameState = data.gameState;
            // Load existing live cells
            data.liveCells.forEach((cell) => {
                this.liveCells.set(`${cell.x},${cell.y}`, cell);
            });
            this.displayGrid();
        });
        // Real-time updates
        this.socketClient.onMove((data) => {
            console.log('👤 Player move received:', data);
        });
        this.socketClient.onChunkUpdate((data) => {
            console.log('🔲 Chunk update received:', data);
            // Apply chunk changes
            if (data.changes) {
                for (const change of data.changes) {
                    const cellKey = `${change.x},${change.y}`;
                    if (change.newValue && change.newValue !== null) {
                        // Cell became alive
                        this.liveCells.set(cellKey, {
                            x: change.x,
                            y: change.y,
                            alive: true,
                            playerId: change.playerId,
                            generation: this.gameState?.generation || 0
                        });
                    }
                    else {
                        // Cell died
                        this.liveCells.delete(cellKey);
                    }
                }
                this.displayGrid();
            }
        });
        // Conway-specific events
        this.socketClient.on('cell-placed', (data) => {
            console.log(`📍 Cell placed by ${data.playerId} at (${data.x}, ${data.y})`);
            const cellKey = `${data.x},${data.y}`;
            this.liveCells.set(cellKey, {
                x: data.x,
                y: data.y,
                alive: true,
                playerId: data.playerId,
                generation: this.gameState?.generation || 0
            });
            this.displayGrid();
        });
        this.socketClient.on('generation-updated', (data) => {
            console.log(`🔄 Generation ${data.generation}: ${data.aliveCells} alive cells`);
            if (this.gameState) {
                this.gameState.generation = data.generation;
                this.gameState.aliveCells = data.aliveCells;
            }
        });
        this.socketClient.on('pattern-placed', (data) => {
            console.log(`🎨 Pattern '${data.pattern}' placed by ${data.playerId} at (${data.x}, ${data.y})`);
        });
        this.socketClient.on('speed-changed', (data) => {
            console.log(`⚡ Speed changed to ${data.speed}ms by ${data.playerId}`);
            if (this.gameState) {
                this.gameState.speed = data.speed;
            }
        });
        // Player events
        this.socketClient.onPlayerEvent((data) => {
            console.log(`👥 Player event: ${data.event}`, data);
        });
    }
    /**
     * Display the current grid state (simplified console visualization)
     */
    displayGrid() {
        if (this.liveCells.size === 0) {
            console.log('📊 Grid: Empty');
            return;
        }
        // Find bounds of live cells
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const cell of this.liveCells.values()) {
            minX = Math.min(minX, cell.x);
            maxX = Math.max(maxX, cell.x);
            minY = Math.min(minY, cell.y);
            maxY = Math.max(maxY, cell.y);
        }
        // Limit display size
        const displayMinX = Math.max(minX, -10);
        const displayMaxX = Math.min(maxX, 10);
        const displayMinY = Math.max(minY, -10);
        const displayMaxY = Math.min(maxY, 10);
        console.log(`📊 Grid (${this.liveCells.size} alive cells, generation ${this.gameState?.generation || 0}):`);
        for (let y = displayMaxY; y >= displayMinY; y--) {
            let row = `${y.toString().padStart(3)} `;
            for (let x = displayMinX; x <= displayMaxX; x++) {
                const cellKey = `${x},${y}`;
                const cell = this.liveCells.get(cellKey);
                if (cell) {
                    // Use different symbols for different players
                    const symbol = cell.playerId === this.playerId ? '●' : '○';
                    row += symbol + ' ';
                }
                else {
                    row += '· ';
                }
            }
            console.log(row);
        }
        // X-axis labels
        let xAxis = '    ';
        for (let x = displayMinX; x <= displayMaxX; x++) {
            xAxis += x.toString().slice(-1) + ' ';
        }
        console.log(xAxis);
    }
    /**
     * Get current game statistics
     */
    getStats() {
        return {
            gameId: this.gameId,
            playerId: this.playerId,
            connected: this.socketClient.isConnected(),
            gameState: this.gameState,
            liveCells: this.liveCells.size,
            subscribedChunks: this.socketClient.getSubscribedChunks().length
        };
    }
    /**
     * Disconnect from the game
     */
    async disconnect() {
        console.log('👋 Disconnecting from Conway\'s Life...');
        this.socketClient.disconnect();
        console.log('✅ Disconnected');
    }
}
exports.ConwayLifeClient = ConwayLifeClient;
/**
 * Interactive demo showing real-time multiplayer Conway's Life
 */
async function runDemo() {
    console.log('🎮 Conway\'s Game of Life - Real-time Multiplayer Demo');
    console.log('='.repeat(60));
    const client = new ConwayLifeClient();
    try {
        // Connect to server
        await client.connect();
        // Create a new game
        const gameId = await client.createGame();
        await client.joinGame(gameId);
        console.log('\n🎯 Demo Actions:');
        // Place some initial cells
        console.log('\n1️⃣  Placing individual cells...');
        await client.placeCell(0, 0);
        await client.placeCell(1, 0);
        await client.placeCell(2, 0);
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Place a glider pattern
        console.log('\n2️⃣  Placing a glider pattern...');
        await client.placePattern('glider', 5, 5);
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Change speed
        console.log('\n3️⃣  Changing simulation speed...');
        await client.setSpeed(1000); // 1 second per generation
        // Wait and show stats
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('\n📊 Final Statistics:');
        console.log(JSON.stringify(client.getStats(), null, 2));
        console.log('\n✨ Demo completed successfully!');
    }
    catch (error) {
        console.error('❌ Demo failed:', error);
    }
    finally {
        await client.disconnect();
    }
}
// Run demo if this file is executed directly
if (require.main === module) {
    runDemo().catch(console.error);
}
//# sourceMappingURL=client-demo.js.map