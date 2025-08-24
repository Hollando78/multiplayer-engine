/**
 * @multiplayer-engine/core
 * 
 * Core abstractions and interfaces for multiplayer game engines.
 * Extracted from Territory Conquest game engine.
 */

// Main engine abstractions
export { GameEngine, BaseResourceManager, MoveValidator } from './GameEngine';

// Resource management system
export { 
  ResourceManager, 
  InMemoryResourceManager,
  type ResourceConfig,
  type PlayerResources,
  type ResourceSpendResult,
  type ResourceStatus
} from './ResourceManager';

// Game state management
export {
  GameStateManager,
  InMemoryGameStateManager,
  GameStateUtils,
  GameStatus,
  type BaseGameState,
  type GameStateUpdate,
  type StateSubscriber,
  type ValidationResult
} from './GameState';

// Core type definitions
export type {
  MoveResult,
  CellChange,
  ScoreResult,
  WinResult,
  GameStateSnapshot
} from './GameEngine';