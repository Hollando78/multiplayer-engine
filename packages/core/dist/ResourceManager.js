"use strict";
/**
 * ResourceManager - Handles resource regeneration and spending for games
 * Extracted from Territory Conquest's move regeneration system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryResourceManager = exports.ResourceManager = void 0;
const GameEngine_1 = require("./GameEngine");
/**
 * Base ResourceManager class with regeneration logic
 * Storage implementation is abstract to allow different persistence layers
 */
class ResourceManager extends GameEngine_1.BaseResourceManager {
    constructor(config) {
        super(config);
    }
    /**
     * Calculate current available resources based on regeneration
     */
    calculateAvailableResources(currentBank, lastRegenAt) {
        const now = new Date();
        const lastRegen = new Date(lastRegenAt);
        const secondsSinceRegen = Math.floor((now.getTime() - lastRegen.getTime()) / 1000);
        const resourcesRegened = Math.floor(secondsSinceRegen / this.config.regenSeconds);
        return Math.min(this.config.max, currentBank + resourcesRegened);
    }
    /**
     * Spend a resource unit and update player state
     */
    async spendResource(playerId) {
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
        let newBank;
        let newLastRegenAt = playerData.lastRegenAt;
        if (resourcesRegened > 0) {
            // Resources have regenerated, update bank and timestamp
            newBank = Math.min(this.config.max, playerData.current + resourcesRegened) - 1;
            const consumedRegenTime = resourcesRegened * this.config.regenSeconds;
            newLastRegenAt = new Date(lastRegen.getTime() + consumedRegenTime * 1000);
        }
        else {
            // No regeneration, just spend from current bank
            newBank = playerData.current - 1;
        }
        // Ensure bank never goes negative
        newBank = Math.max(0, newBank);
        const updatedResources = {
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
    async canSpend(playerId) {
        const playerData = await this.loadPlayerResources(playerId);
        const available = this.calculateAvailableResources(playerData.current, playerData.lastRegenAt);
        return available > 0;
    }
    /**
     * Get complete resource status for a player
     */
    async getResourceStatus(playerId) {
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
    getNextRegenTime(currentBank, lastRegenAt) {
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
    getTimeUntilMaxResources(currentBank, lastRegenAt) {
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
    async initializePlayer(playerId) {
        const now = new Date();
        const initialResources = {
            current: this.config.starting,
            lastRegenAt: now,
            lastSpent: now
        };
        await this.savePlayerResources(playerId, initialResources);
        return initialResources;
    }
}
exports.ResourceManager = ResourceManager;
/**
 * In-memory ResourceManager implementation for testing and development
 */
class InMemoryResourceManager extends ResourceManager {
    playerData = new Map();
    async loadPlayerResources(playerId) {
        let resources = this.playerData.get(playerId);
        if (!resources) {
            resources = await this.initializePlayer(playerId);
        }
        return resources;
    }
    async savePlayerResources(playerId, resources) {
        this.playerData.set(playerId, { ...resources });
    }
    /**
     * Utility method for testing - get all player data
     */
    getAllPlayerData() {
        return new Map(this.playerData);
    }
    /**
     * Utility method for testing - clear all data
     */
    clearAllData() {
        this.playerData.clear();
    }
}
exports.InMemoryResourceManager = InMemoryResourceManager;
//# sourceMappingURL=ResourceManager.js.map