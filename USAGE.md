# Multiplayer Engine Usage Guide

Complete instructions for using the extracted multiplayer game engine packages.

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Authentication System](#authentication-system)
3. [Game Storage](#game-storage)
4. [Real-time Multiplayer](#real-time-multiplayer)
5. [Canvas Rendering](#canvas-rendering)
6. [Complete Game Example](#complete-game-example)
7. [Production Deployment](#production-deployment)

## Quick Setup

### Prerequisites

```bash
# Required software
node >= 18.0.0
pnpm >= 8.0.0
postgresql >= 13.0.0
redis >= 6.0.0
```

### Installation

```bash
# Clone and install
git clone <repository-url>
cd multiplayer-engine
pnpm install
pnpm build
```

### Environment Variables

Create `.env` file in your project root:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/gamedb"

# Authentication (32+ character secrets)
JWT_SECRET="your-super-secure-jwt-secret-here-minimum-32-chars"
REFRESH_SECRET="your-super-secure-refresh-secret-here-minimum-32-chars"

# Redis
REDIS_URL="redis://localhost:6379"

# Application
NODE_ENV="development"
PORT=3000
```

## Authentication System

### Basic Setup

```typescript
import { AuthManager, AuthMiddleware } from '@multiplayer-engine/auth';
import { PrismaAuthStorage } from '@multiplayer-engine/storage';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(cookieParser());

// Initialize Prisma
const prisma = new PrismaClient();

// Create auth manager
const authManager = new AuthManager({
  jwtSecret: process.env.JWT_SECRET!,
  accessTokenTTL: '15m',        // Access tokens expire in 15 minutes
  refreshTokenTTL: '7d',        // Refresh cookies expire in 7 days
  bcryptRounds: 12,             // Password hashing rounds
  cookieSettings: {
    httpOnly: true,             // Prevent XSS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',           // CSRF protection
    path: '/api/auth'          // Restrict cookie scope
  }
}, new PrismaAuthStorage(prisma));

// Create middleware
const authMiddleware = new AuthMiddleware(authManager);
```

### Auth Routes

```typescript
// Add authentication routes
app.use('/api/auth', authMiddleware.createAuthRoutes());

// Protected routes
app.get('/api/profile', authMiddleware.authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Optional auth (public with user context if logged in)
app.get('/api/games', authMiddleware.optionalAuth, async (req, res) => {
  const userId = req.user?.id;
  const games = await getGamesForUser(userId);
  res.json(games);
});

// Rate limited route
app.post('/api/contact', authMiddleware.apiRateLimit, (req, res) => {
  // Limited to 100 requests per minute
  sendContactForm(req.body);
});
```

### Frontend Integration

```typescript
// Login flow
const login = async (email: string, password: string) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Important: include cookies
    body: JSON.stringify({ email, password })
  });

  if (response.ok) {
    const { user, accessToken } = await response.json();
    // Store access token in memory (NOT localStorage)
    setCurrentUser(user);
    setAccessToken(accessToken);
  }
};

// API requests with automatic token refresh
const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true // Include refresh cookies
});

// Intercept 401 responses to refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      
      try {
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });
        
        if (refreshResponse.ok) {
          const { accessToken } = await refreshResponse.json();
          setAccessToken(accessToken);
          
          // Retry original request
          error.config.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient.request(error.config);
        }
      } catch {
        // Refresh failed, redirect to login
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);
```

## Game Storage

### Setup Game Storage

```typescript
import { PrismaGameStorage } from '@multiplayer-engine/storage';

const gameStorage = new PrismaGameStorage(prisma);
```

### Creating Games

```typescript
// Create a new game
const createGame = async (ownerId: string, gameData: any) => {
  const game = await gameStorage.createGame(ownerId, {
    title: 'My Chess Game',
    gameType: 'chess',
    maxPlayers: 2,
    initialGameState: {
      board: initializeChessBoard(),
      currentPlayer: 'white',
      moveHistory: []
    }
  });
  
  return game;
};
```

### Managing Players

```typescript
// Join a game
const joinGame = async (gameId: string, userId: string) => {
  try {
    const result = await gameStorage.joinGame(gameId, userId);
    console.log(`Joined as player ${result.playerIndex}`);
    
    // Check if game is now full and should start
    if (result.game.players?.length === result.game.maxPlayers) {
      await gameStorage.updateGameStatus(gameId, 'ACTIVE');
    }
    
    return result;
  } catch (error) {
    console.error('Failed to join game:', error.message);
  }
};

// Leave a game
const leaveGame = async (gameId: string, userId: string) => {
  await gameStorage.leaveGame(gameId, userId);
  
  // Game might be marked as abandoned if no active players remain
  const playerCount = await gameStorage.getActivePlayersCount(gameId);
  console.log(`${playerCount} active players remaining`);
};
```

### Making Moves

```typescript
// Make a move with optimistic locking
const makeMove = async (gameId: string, userId: string, moveData: any) => {
  const game = await gameStorage.getGame(gameId);
  
  const result = await gameStorage.makeMove({
    gameId,
    userId,
    moveData,
    expectedStateVersion: game?.stateVersion // Prevent race conditions
  });
  
  // Update game state if needed
  if (result.stateUpdated) {
    const newGameState = calculateNewGameState(game.gameState, moveData);
    await gameStorage.updateGameState(gameId, newGameState);
  }
  
  return result;
};
```

## Real-time Multiplayer

### Server Setup

```typescript
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SocketManager, PubSubManager, StateSync } from '@multiplayer-engine/realtime';
import Redis from 'ioredis';

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
});

// Initialize real-time components
const redis = new Redis(process.env.REDIS_URL);
const pubsub = new PubSubManager(redis);
const socketManager = new SocketManager(io);

// Set up state synchronization
const stateSync = new StateSync({
  pubsub,
  socketManager,
  gameStorage,
  conflictResolution: 'server-wins' // or 'timestamp' or 'merge'
});

// Handle connection
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('join-game', async (gameId) => {
    const userId = socket.data.userId; // From auth middleware
    
    // Verify user can join this game
    const access = await gameStorage.checkGameAccess(gameId, userId);
    if (access.canAccess) {
      await socketManager.joinGameRoom(socket.id, gameId);
      socket.join(`game:${gameId}`);
      
      // Send current game state
      const game = await gameStorage.getGame(gameId, { 
        includeOwner: true, 
        includePlayers: true 
      });
      socket.emit('game-state', game);
    }
  });
  
  socket.on('game-move', async (data) => {
    const { gameId, moveData } = data;
    const userId = socket.data.userId;
    
    try {
      // Process move with automatic state sync
      const result = await stateSync.processMove({
        gameId,
        userId,
        moveData,
        socketId: socket.id
      });
      
      // Broadcast to all players in the game
      socketManager.broadcastToGame(gameId, 'move-made', {
        playerId: userId,
        move: result.move,
        gameState: result.gameState
      });
      
    } catch (error) {
      socket.emit('move-error', { error: error.message });
    }
  });
});
```

### Frontend Real-time Integration

```typescript
import io from 'socket.io-client';

class GameClient {
  private socket: Socket;
  private gameId: string;
  
  constructor(gameId: string, accessToken: string) {
    this.gameId = gameId;
    this.socket = io('/', {
      auth: { token: accessToken },
      withCredentials: true
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to game server');
      this.socket.emit('join-game', this.gameId);
    });
    
    this.socket.on('game-state', (game) => {
      this.updateGameUI(game);
    });
    
    this.socket.on('move-made', (data) => {
      this.animateMove(data.move);
      this.updateGameState(data.gameState);
    });
    
    this.socket.on('player-joined', (player) => {
      this.showNotification(`${player.username} joined the game`);
    });
    
    this.socket.on('move-error', (data) => {
      this.showError(data.error);
    });
  }
  
  makeMove(moveData: any) {
    // Optimistic update
    this.updateGameStateOptimistically(moveData);
    
    // Send to server
    this.socket.emit('game-move', {
      gameId: this.gameId,
      moveData
    });
  }
  
  disconnect() {
    this.socket.disconnect();
  }
}
```

## Canvas Rendering

### Setup Canvas Renderer

```typescript
import { 
  CanvasRenderer, 
  ViewportManager, 
  AnimationEngine, 
  ThemeEngine,
  InputManager 
} from '@multiplayer-engine/rendering';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

// Initialize renderer
const renderer = new CanvasRenderer(canvas, {
  cellSize: 20,
  gridColor: '#333333',
  backgroundColor: '#000000',
  showGrid: true,
  gridOpacity: 0.3
});

// Setup viewport controls
const viewport = new ViewportManager(canvas, {
  minZoom: 0.5,
  maxZoom: 5.0,
  enableTouch: true,
  enableMouse: true,
  enableKeyboard: true,
  boundingBox: {
    minX: -1000,
    maxX: 1000,
    minY: -1000,
    maxY: 1000
  }
});

// Initialize theming
const theme = new ThemeEngine({
  themes: {
    light: {
      background: '#ffffff',
      grid: '#e0e0e0',
      text: '#000000',
      accent: '#0066cc'
    },
    dark: {
      background: '#1a1a1a',
      grid: '#333333',
      text: '#ffffff',
      accent: '#66b3ff'
    }
  },
  defaultTheme: 'dark'
});

// Setup animations
const animation = new AnimationEngine();
```

### Handle User Input

```typescript
const inputManager = new InputManager(canvas);

// Handle different input types
inputManager.on('cell-click', (worldPos) => {
  console.log(`Clicked cell at ${worldPos.x}, ${worldPos.y}`);
  makeMove(worldPos.x, worldPos.y);
});

inputManager.on('cell-hover', (worldPos) => {
  renderer.setHighlight(worldPos.x, worldPos.y);
  renderer.render();
});

viewport.on('zoom-change', (zoomLevel) => {
  console.log(`Zoom level: ${zoomLevel}`);
  renderer.render();
});

viewport.on('pan', (position) => {
  console.log(`View centered at ${position.x}, ${position.y}`);
  renderer.render();
});
```

### Render Game State

```typescript
// Game rendering loop
class GameRenderer {
  private cells = new Map<string, { x: number; y: number; color: string }>();
  
  updateCell(x: number, y: number, color: string) {
    this.cells.set(`${x},${y}`, { x, y, color });
    this.render();
  }
  
  render() {
    const viewportState = viewport.getState();
    
    // Clear canvas
    renderer.clear();
    
    // Draw grid (if visible at current zoom)
    if (viewportState.zoom > 0.5) {
      renderer.drawGrid(viewportState);
    }
    
    // Draw all cells
    for (const cell of this.cells.values()) {
      const screenPos = renderer.worldToScreen(cell.x, cell.y, viewportState);
      renderer.drawCell(screenPos.x, screenPos.y, cell.color);
    }
    
    // Draw UI overlay
    this.drawUI();
  }
  
  animateMove(fromX: number, fromY: number, toX: number, toY: number) {
    animation.animate({
      duration: 300,
      easing: 'ease-out',
      onUpdate: (progress) => {
        const currentX = fromX + (toX - fromX) * progress;
        const currentY = fromY + (toY - fromY) * progress;
        
        // Draw moving piece
        const viewportState = viewport.getState();
        const screenPos = renderer.worldToScreen(currentX, currentY, viewportState);
        renderer.drawMovingPiece(screenPos.x, screenPos.y);
      },
      onComplete: () => {
        this.updateCell(toX, toY, 'player');
        this.render();
      }
    });
  }
}
```

## Complete Game Example

Here's a complete implementation of a multiplayer Tic-Tac-Toe game:

```typescript
// server.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { AuthManager, AuthMiddleware } from '@multiplayer-engine/auth';
import { PrismaGameStorage, PrismaAuthStorage } from '@multiplayer-engine/storage';
import { SocketManager, PubSubManager } from '@multiplayer-engine/realtime';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const app = express();
const server = createServer(app);
const io = new Server(server);
const prisma = new PrismaClient();
const redis = new Redis();

// Setup auth
const authManager = new AuthManager({
  jwtSecret: process.env.JWT_SECRET!,
  accessTokenTTL: '15m',
  refreshTokenTTL: '7d',
  bcryptRounds: 12
}, new PrismaAuthStorage(prisma));

const authMiddleware = new AuthMiddleware(authManager);
app.use('/api/auth', authMiddleware.createAuthRoutes());

// Setup game storage
const gameStorage = new PrismaGameStorage(prisma);

// Setup real-time
const socketManager = new SocketManager(io);
const pubsub = new PubSubManager(redis);

// Game logic
class TicTacToeGame {
  private board: string[][] = [
    ['', '', ''],
    ['', '', ''],
    ['', '', '']
  ];
  
  makeMove(x: number, y: number, player: string): boolean {
    if (this.board[y][x] === '') {
      this.board[y][x] = player;
      return true;
    }
    return false;
  }
  
  checkWinner(): string | null {
    // Check rows, columns, diagonals
    const lines = [
      // Rows
      [this.board[0][0], this.board[0][1], this.board[0][2]],
      [this.board[1][0], this.board[1][1], this.board[1][2]],
      [this.board[2][0], this.board[2][1], this.board[2][2]],
      // Columns
      [this.board[0][0], this.board[1][0], this.board[2][0]],
      [this.board[0][1], this.board[1][1], this.board[2][1]],
      [this.board[0][2], this.board[1][2], this.board[2][2]],
      // Diagonals
      [this.board[0][0], this.board[1][1], this.board[2][2]],
      [this.board[0][2], this.board[1][1], this.board[2][0]]
    ];
    
    for (const line of lines) {
      if (line[0] && line[0] === line[1] && line[1] === line[2]) {
        return line[0];
      }
    }
    
    return null;
  }
  
  getState() {
    return {
      board: this.board,
      winner: this.checkWinner()
    };
  }
}

// Game routes
app.post('/api/games', authMiddleware.authenticate, async (req, res) => {
  const game = await gameStorage.createGame(req.user.id, {
    title: req.body.title || 'Tic-Tac-Toe',
    gameType: 'tic-tac-toe',
    maxPlayers: 2,
    initialGameState: { board: [['','',''],['','',''],['','','']] }
  });
  
  res.json(game);
});

// Socket events
io.on('connection', (socket) => {
  socket.on('join-game', async (gameId) => {
    socket.join(`game:${gameId}`);
    
    const game = await gameStorage.getGame(gameId, { includePlayers: true });
    socket.emit('game-state', game);
  });
  
  socket.on('make-move', async (data) => {
    const { gameId, x, y } = data;
    const userId = socket.data.userId;
    
    try {
      const game = await gameStorage.getGame(gameId);
      const tictactoe = new TicTacToeGame();
      tictactoe.board = game.gameState.board;
      
      const playerSymbol = userId === game.ownerId ? 'X' : 'O';
      
      if (tictactoe.makeMove(x, y, playerSymbol)) {
        const newState = tictactoe.getState();
        
        await gameStorage.updateGameState(gameId, newState);
        await gameStorage.makeMove({
          gameId,
          userId,
          moveData: { x, y, symbol: playerSymbol }
        });
        
        io.to(`game:${gameId}`).emit('move-made', {
          x, y, symbol: playerSymbol,
          gameState: newState
        });
        
        if (newState.winner) {
          await gameStorage.updateGameStatus(gameId, 'FINISHED');
          io.to(`game:${gameId}`).emit('game-over', { winner: newState.winner });
        }
      }
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });
});

server.listen(3000, () => {
  console.log('Game server running on port 3000');
});
```

```html
<!-- client.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Tic-Tac-Toe</title>
    <style>
        .board {
            display: grid;
            grid-template-columns: repeat(3, 100px);
            grid-gap: 2px;
            margin: 20px;
        }
        .cell {
            width: 100px;
            height: 100px;
            border: 1px solid #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            cursor: pointer;
        }
        .cell:hover {
            background-color: #f0f0f0;
        }
    </style>
</head>
<body>
    <div id="game">
        <h1>Tic-Tac-Toe</h1>
        <div id="board" class="board"></div>
        <div id="status"></div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let gameId = 'demo-game'; // In real app, get from URL or create
        let currentGame = null;

        // Join game
        socket.emit('join-game', gameId);

        // Handle events
        socket.on('game-state', (game) => {
            currentGame = game;
            renderBoard(game.gameState.board);
        });

        socket.on('move-made', (data) => {
            updateCell(data.x, data.y, data.symbol);
            if (data.gameState.winner) {
                document.getElementById('status').textContent = 
                    `Game Over! Winner: ${data.gameState.winner}`;
            }
        });

        socket.on('game-over', (data) => {
            document.getElementById('status').textContent = 
                `Game Over! Winner: ${data.winner}`;
        });

        // Render board
        function renderBoard(board) {
            const boardElement = document.getElementById('board');
            boardElement.innerHTML = '';
            
            for (let y = 0; y < 3; y++) {
                for (let x = 0; x < 3; x++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    cell.textContent = board[y][x];
                    cell.onclick = () => makeMove(x, y);
                    boardElement.appendChild(cell);
                }
            }
        }

        function makeMove(x, y) {
            if (currentGame) {
                socket.emit('make-move', { gameId, x, y });
            }
        }

        function updateCell(x, y, symbol) {
            const cells = document.querySelectorAll('.cell');
            const cellIndex = y * 3 + x;
            cells[cellIndex].textContent = symbol;
        }
    </script>
</body>
</html>
```

## Production Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Expose port
EXPOSE 3000

CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://gameuser:${DB_PASSWORD}@postgres:5432/gamedb
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - REFRESH_SECRET=${REFRESH_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=gamedb
      - POSTGRES_USER=gameuser
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Environment Variables for Production

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://gameuser:secure_password@postgres:5432/gamedb
REDIS_URL=redis://redis:6379

# Secrets (generate with: openssl rand -hex 32)
JWT_SECRET=your_production_jwt_secret_32_chars_min
REFRESH_SECRET=your_production_refresh_secret_32_chars_min

# CORS
FRONTEND_URL=https://yourdomain.com

# Rate limiting (production values)
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=5    # 5 auth requests per window
API_RATE_LIMIT_MAX=500       # 500 API requests per minute
```

### SSL and Security

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # Rate limiting
        limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
        limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

        location /api/auth {
            limit_req zone=auth burst=10 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /api {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /socket.io/ {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

This completes the comprehensive usage guide for the multiplayer engine packages. The documentation covers everything from basic setup to production deployment, with working code examples throughout.