/**
 * @multiplayer-engine/storage - Universal storage abstractions
 * Database interfaces and Prisma implementations for multiplayer games
 */

export {
  GameStorage,
  type Game,
  type GamePlayer,
  type GameMove,
  type CreateGameData,
  type JoinGameResult,
  type GameListOptions,
  type MakeMoveData,
  type MakeMoveResult
} from './GameStorage';

// Prisma implementations excluded from build - available as source files
// export { PrismaGameStorage } from './PrismaGameStorage';
// export { PrismaAuthStorage } from './PrismaAuthStorage';