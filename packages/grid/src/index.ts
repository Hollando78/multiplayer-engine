/**
 * @multiplayer-engine/grid
 * 
 * Grid-based game engine specialization with spatial algorithms,
 * flood-fill operations, and chunk management.
 * Extracted from Territory Conquest game engine.
 */

// Main grid engine
export { 
  GridGameEngine, 
  GridManager, 
  ChunkManager 
} from './GridGameEngine';

// Territory implementation (reference example)
export { TerritoryEngine } from './TerritoryEngine';

// Type definitions
export type {
  GridOptions,
  GridCoordinate,
  GridCell,
  GridMoveData,
  FloodFillRegion,
  ChunkData,
  GridGameRules,
  GridMoveResult
} from './GridGameEngine';

export type {
  TerritoryGameState,
  TerritoryRules,
  TerritoryGridOptions
} from './TerritoryEngine';