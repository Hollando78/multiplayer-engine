/**
 * @multiplayer-engine/core
 *
 * Core abstractions and interfaces for multiplayer game engines.
 * Extracted from Territory Conquest game engine.
 */
export { GameEngine, BaseResourceManager, MoveValidator } from './GameEngine';
export { ResourceManager, InMemoryResourceManager, type ResourceConfig, type PlayerResources, type ResourceSpendResult, type ResourceStatus } from './ResourceManager';
export { GameStateManager, InMemoryGameStateManager, GameStateUtils, GameStatus, type BaseGameState, type GameStateUpdate, type StateSubscriber, type ValidationResult } from './GameState';
export type { MoveResult, CellChange, ScoreResult, WinResult, GameStateSnapshot } from './GameEngine';
//# sourceMappingURL=index.d.ts.map