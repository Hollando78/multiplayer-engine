/**
 * ResourceManager - Handles resource regeneration and spending for games
 * Extracted from Territory Conquest's move regeneration system
 */
import { BaseResourceManager } from './GameEngine';
export interface ResourceConfig {
    max: number;
    regenSeconds: number;
    starting: number;
}
export interface PlayerResources {
    current: number;
    lastRegenAt: Date;
    lastSpent: Date;
}
export interface ResourceSpendResult {
    success: boolean;
    error?: string;
    newBank?: number;
    newLastRegenAt?: Date;
    availableAfterSpend?: number;
}
export interface ResourceStatus {
    current: number;
    max: number;
    nextRegenTime: Date | null;
    timeUntilMaxResources: number;
}
/**
 * Base ResourceManager class with regeneration logic
 * Storage implementation is abstract to allow different persistence layers
 */
export declare abstract class ResourceManager extends BaseResourceManager {
    constructor(config: ResourceConfig);
    /**
     * Calculate current available resources based on regeneration
     */
    calculateAvailableResources(currentBank: number, lastRegenAt: Date): number;
    /**
     * Spend a resource unit and update player state
     */
    spendResource(playerId: string): Promise<ResourceSpendResult>;
    /**
     * Check if player can spend a resource
     */
    canSpend(playerId: string): Promise<boolean>;
    /**
     * Get complete resource status for a player
     */
    getResourceStatus(playerId: string): Promise<ResourceStatus>;
    /**
     * Get timestamp of next resource regeneration
     */
    getNextRegenTime(currentBank: number, lastRegenAt: Date): Date | null;
    /**
     * Get time in seconds until resources are at maximum
     */
    getTimeUntilMaxResources(currentBank: number, lastRegenAt: Date): number;
    /**
     * Initialize a new player with starting resources
     */
    initializePlayer(playerId: string): Promise<PlayerResources>;
    protected abstract loadPlayerResources(playerId: string): Promise<PlayerResources>;
    protected abstract savePlayerResources(playerId: string, resources: PlayerResources): Promise<void>;
}
/**
 * In-memory ResourceManager implementation for testing and development
 */
export declare class InMemoryResourceManager extends ResourceManager {
    private playerData;
    protected loadPlayerResources(playerId: string): Promise<PlayerResources>;
    protected savePlayerResources(playerId: string, resources: PlayerResources): Promise<void>;
    /**
     * Utility method for testing - get all player data
     */
    getAllPlayerData(): Map<string, PlayerResources>;
    /**
     * Utility method for testing - clear all data
     */
    clearAllData(): void;
}
//# sourceMappingURL=ResourceManager.d.ts.map