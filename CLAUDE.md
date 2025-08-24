# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a TypeScript multiplayer game engine extracted from the Territory Conquest production game. It uses a pnpm workspace architecture with 6 specialized packages and working examples.

The engine provides reusable abstractions for building sophisticated multiplayer games with real-time synchronization, resource management, and grid-based mechanics.

## Essential Commands

### Workspace Operations
```bash
# Install all dependencies
pnpm install

# Bootstrap entire project (install + build all packages)
pnpm bootstrap

# Build all packages
pnpm build

# Test all packages
pnpm test

# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck

# Watch mode for development (all packages in parallel)
pnpm dev

# Clean all build artifacts
pnpm clean
```

### Package-specific Commands
```bash
# Work with individual packages
pnpm --filter @multiplayer-engine/core build
pnpm --filter @multiplayer-engine/core test
pnpm --filter @multiplayer-engine/core dev    # watch mode

# Run example games
cd examples/chess && pnpm dev
cd examples/conway-life && pnpm dev
```

## Core Architecture Patterns

### Package Ecosystem
- **@multiplayer-engine/core** - Base GameEngine with universal move pipeline and resource management
- **@multiplayer-engine/grid** - GridGameEngine with flood-fill algorithms and spatial utilities  
- **@multiplayer-engine/realtime** - WebSocket + Redis real-time multiplayer with optimistic updates
- **@multiplayer-engine/rendering** - Canvas renderer with viewport controls and animations
- **@multiplayer-engine/auth** - JWT authentication with dual-token security
- **@multiplayer-engine/storage** - Database abstractions with Prisma implementations

### Game Engine Abstraction

Every game extends the base `GameEngine` class which provides a universal move processing pipeline:

1. **Resource validation** - Check if player can make move
2. **Move validation** - Game-specific rules checking  
3. **Move application** - Apply changes to game state
4. **Resource spending** - Deduct move cost from player
5. **Win condition checking** - Determine if game is complete

The engine is fully generic with type parameters: `GameEngine<TGameState, TMoveData, TGameRules>`.

### Grid Game Specialization

`GridGameEngine` extends the base engine for spatial games, adding:
- **Spatial algorithms**: `floodFill()`, `findEnclosedAreas()`, `get4Neighbors()`, `get8Neighbors()`
- **Chunk management**: Efficient operations on large worlds via `ChunkManager`
- **Coordinate utilities**: World/screen conversion, bounds checking, distance calculation
- **Territory mechanics**: Sophisticated flood-fill with enclosure detection (extracted from Territory Conquest)

### Real-time Multiplayer Architecture

The real-time system provides:
- **Optimistic updates** with server-side conflict resolution via `StateSync`
- **PubSub messaging** through Redis for scalable real-time updates
- **WebSocket management** with room-based subscriptions via `SocketManager`
- **State synchronization** with configurable conflict resolution strategies
- **Chunk-based updates** for efficient large world synchronization

### Resource Management System

Sophisticated resource system supporting:
- **Move regeneration** at configurable intervals
- **Resource limits** with maximum capacity per player
- **Spending validation** to ensure sufficient resources
- **Multiple storage backends** via abstract `BaseResourceManager`

## Key Implementation Patterns

### Game Implementation Process
1. Extend `GameEngine` or `GridGameEngine`
2. Implement abstract methods: `validateMove()`, `applyMove()`, `checkWinCondition()`
3. Configure resource management via `createResourceManager()`
4. Define game state, rules, and move data types
5. Implement persistence layer (optional - can use in-memory for prototypes)

### Grid Game Implementation
```typescript
class MyGridGame extends GridGameEngine<MyGameState, MyGameRules> {
  // Define what constitutes a valid move
  async canPlaceAt(x: number, y: number, playerId: string): Promise<boolean>
  
  // Apply move and return affected cells/chunks  
  async applyGridMove(x: number, y: number, playerId: string): Promise<GridMoveResult>
  
  // Load/save cells for persistence
  protected async loadCells(bounds): Promise<GridCell[]>
  protected async saveCells(cells: GridCell[]): Promise<void>
}
```

### Real-time Integration
```typescript
// Server-side setup
const stateSync = new StateSync({ pubsub, socketManager, gameStorage });
const socketManager = new SocketManager(io);

// Optimistic updates
await stateSync.applyOptimisticUpdate(gameId, playerId, 'move', moveData, rollbackData);

// State synchronization
stateSync.onStateUpdate(gameId, (gameId, newState, update) => {
  // Handle state changes
});
```

### Authentication Integration  
```typescript
// Dual-token security with HTTP-only refresh cookies
const authManager = new AuthManager({
  jwtSecret: process.env.JWT_SECRET,
  accessTokenTTL: '15m',
  refreshTokenTTL: '7d'
}, authStorage);

// Express.js middleware with built-in rate limiting
app.use('/api/auth', authMiddleware.createAuthRoutes());
app.get('/protected', authMiddleware.authenticate, handler);
```

## Development Workflow

### TypeScript Configuration
- Uses modern TypeScript 5.0+ with strict mode enabled
- Bundler module resolution for optimal tree-shaking
- Path mapping for internal package references
- Declaration generation for published packages

### Package Dependencies
- Packages use `workspace:*` for internal dependencies
- Each package builds independently with `tsc`
- Dev dependencies shared at workspace root
- Clean separation of concerns between packages

### Testing Strategy
- Vitest for unit testing across all packages
- Each package has its own test suite
- Run individual package tests: `pnpm --filter @multiplayer-engine/core test`

### Example Games Architecture
Examples demonstrate different game patterns:
- **Chess**: Turn-based strategy on finite 8x8 grid (~100 lines)
- **Conway's Life**: Real-time cellular automaton with client-server sync
- Both show complete implementation from engine extension to UI

## Build System Details

### Package Structure
Each package follows consistent structure:
```
packages/[name]/
├── src/           # TypeScript source
├── dist/          # Compiled JavaScript + declarations  
├── package.json   # Individual package config
└── tsconfig.json  # Package-specific TypeScript config
```

### pnpm Workspace Benefits
- **Efficient installs**: Shared dependencies via hard links
- **Workspace dependencies**: Internal packages use `workspace:*`
- **Parallel execution**: Commands run across packages simultaneously
- **Selective execution**: Filter commands to specific packages

### Build Outputs
- ESM modules in `dist/` directories
- TypeScript declarations for full type support
- Source maps for debugging
- Optimized for tree-shaking in consumer applications

The architecture emphasizes clean abstractions, type safety, and proven patterns extracted from production multiplayer games.