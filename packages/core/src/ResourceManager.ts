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
  timeUntilMaxResources: number; // seconds
}

/**
 * Base ResourceManager class with regeneration logic
 * Storage implementation is abstract to allow different persistence layers
 */
export abstract class ResourceManager extends BaseResourceManager {
  constructor(config: ResourceConfig) {
    super(config);
  }

  /**
   * Calculate current available resources based on regeneration
   */
  calculateAvailableResources(currentBank: number, lastRegenAt: Date): number {
    const now = new Date();
    const lastRegen = new Date(lastRegenAt);
    const secondsSinceRegen = Math.floor((now.getTime() - lastRegen.getTime()) / 1000);
    const resourcesRegened = Math.floor(secondsSinceRegen / this.config.regenSeconds);
    
    return Math.min(this.config.max, currentBank + resourcesRegened);
  }

  /**
   * Spend a resource unit and update player state
   */
  async spendResource(playerId: string): Promise<ResourceSpendResult> {
    const playerData = await this.loadPlayerResources(playerId);
    const available = this.calculateAvailableResources(playerData.current, playerData.lastRegenAt);
    
    if (available <= 0) {
      return { success: false, error: 'No resources available' };
    }

    const now = new Date();
    const lastRegen = new Date(playerData.lastRegenAt);
    const secondsSinceRegen = Math.floor((now.getTime() - lastRegen.getTime()) / 1000);
    const resourcesRegened = Math.floor(secondsSinceRegen / this.config.regenSeconds);
    
    // Calculate new resource bank and regeneration timestamp
    let newBank: number;
    let newLastRegenAt = playerData.lastRegenAt;

    if (resourcesRegened > 0) {
      // Resources have regenerated, update bank and timestamp
      newBank = Math.min(this.config.max, playerData.current + resourcesRegened) - 1;
      const consumedRegenTime = resourcesRegened * this.config.regenSeconds;
      newLastRegenAt = new Date(lastRegen.getTime() + consumedRegenTime * 1000);
    } else {
      // No regeneration, just spend from current bank
      newBank = playerData.current - 1;
    }

    // Ensure bank never goes negative
    newBank = Math.max(0, newBank);

    const updatedResources: PlayerResources = {
      current: newBank,
      lastRegenAt: newLastRegenAt,
      lastSpent: now
    };

    await this.savePlayerResources(playerId, updatedResources);

    return {
      success: true,
      newBank,
      newLastRegenAt,
      availableAfterSpend: newBank
    };
  }

  /**
   * Check if player can spend a resource
   */
  async canSpend(playerId: string): Promise<boolean> {
    const playerData = await this.loadPlayerResources(playerId);
    const available = this.calculateAvailableResources(playerData.current, playerData.lastRegenAt);
    return available > 0;
  }

  /**
   * Get complete resource status for a player
   */
  async getResourceStatus(playerId: string): Promise<ResourceStatus> {
    const playerData = await this.loadPlayerResources(playerId);
    const current = this.calculateAvailableResources(playerData.current, playerData.lastRegenAt);
    
    return {
      current,
      max: this.config.max,
      nextRegenTime: this.getNextRegenTime(playerData.current, playerData.lastRegenAt),
      timeUntilMaxResources: this.getTimeUntilMaxResources(playerData.current, playerData.lastRegenAt)
    };
  }

  /**
   * Get timestamp of next resource regeneration
   */
  getNextRegenTime(currentBank: number, lastRegenAt: Date): Date | null {
    const available = this.calculateAvailableResources(currentBank, lastRegenAt);
    
    if (available >= this.config.max) {
      return null; // Already at max
    }

    const lastRegen = new Date(lastRegenAt);
    const secondsSinceRegen = Math.floor((Date.now() - lastRegen.getTime()) / 1000);
    const secondsToNextRegen = this.config.regenSeconds - (secondsSinceRegen % this.config.regenSeconds);
    
    return new Date(Date.now() + secondsToNextRegen * 1000);
  }

  /**
   * Get time in seconds until resources are at maximum
   */
  getTimeUntilMaxResources(currentBank: number, lastRegenAt: Date): number {
    const available = this.calculateAvailableResources(currentBank, lastRegenAt);
    
    if (available >= this.config.max) {
      return 0;
    }

    const resourcesNeeded = this.config.max - available;
    return resourcesNeeded * this.config.regenSeconds;
  }

  /**
   * Initialize a new player with starting resources
   */
  async initializePlayer(playerId: string): Promise<PlayerResources> {
    const now = new Date();
    const initialResources: PlayerResources = {
      current: this.config.starting,
      lastRegenAt: now,
      lastSpent: now
    };

    await this.savePlayerResources(playerId, initialResources);
    return initialResources;
  }

  // Abstract methods for persistence - implemented by storage layer
  protected abstract loadPlayerResources(playerId: string): Promise<PlayerResources>;
  protected abstract savePlayerResources(playerId: string, resources: PlayerResources): Promise<void>;
}

/**
 * In-memory ResourceManager implementation for testing and development
 */
export class InMemoryResourceManager extends ResourceManager {
  private playerData: Map<string, PlayerResources> = new Map();

  protected async loadPlayerResources(playerId: string): Promise<PlayerResources> {
    let resources = this.playerData.get(playerId);
    if (!resources) {
      resources = await this.initializePlayer(playerId);
    }
    return resources;
  }

  protected async savePlayerResources(playerId: string, resources: PlayerResources): Promise<void> {
    this.playerData.set(playerId, { ...resources });
  }

  /**
   * Utility method for testing - get all player data
   */
  getAllPlayerData(): Map<string, PlayerResources> {
    return new Map(this.playerData);
  }

  /**
   * Utility method for testing - clear all data
   */
  clearAllData(): void {
    this.playerData.clear();
  }
}