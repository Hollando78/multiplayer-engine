import { BaseResourceManager, ResourceConfig, InMemoryResourceManager } from '@multiplayer-engine/core';
import { GridGameEngine, GridGameRules, GridMoveResult, GridCell, GridOptions } from './GridGameEngine';

/**
 * TerritoryEngine - Reference implementation of the Territory Conquest game
 * Shows how to use the GridGameEngine for sophisticated territory mechanics
 */

export interface TerritoryGameState {
  gameId: string;
  scores: Map<string, number>;
  totalCells: number;
  lastMove?: {
    playerId: string;
    x: number;
    y: number;
    timestamp: Date;
  };
}

export interface TerritoryRules extends GridGameRules {
  resources: ResourceConfig;
  gridOptions: TerritoryGridOptions;
}

export interface TerritoryGridOptions extends GridOptions {
  infinite: true;
  chunkSize: number;
  maxBoundingBox: number;
}

/**
 * Territory Conquest game engine implementation
 */
export class TerritoryEngine extends GridGameEngine<TerritoryGameState, TerritoryRules> {
  
  constructor(gameId: string) {
    const rules: TerritoryRules = {
      gridOptions: {
        infinite: true,
        chunkSize: 64,
        maxBoundingBox: 30
      },
      resources: {
        max: 25,
        regenSeconds: 60,
        starting: 5
      }
    };
    
    super(gameId, rules);
  }

  protected createResourceManager(): BaseResourceManager {
    return new InMemoryResourceManager(this.rules.resources);
  }

  protected createMoveValidator() {
    return new TerritoryMoveValidator();
  }

  /**
   * Territory-specific placement validation
   */
  async canPlaceAt(x: number, y: number, playerId: string, isFirstMove = false): Promise<boolean> {
    if (isFirstMove) {
      return true;
    }

    // Check for standard 4-adjacent owned cells
    const neighbors4 = this.get4Neighbors(x, y);
    const boundingBox = this.rules.gridOptions.maxBoundingBox || 30;
    const cellMap = await this.getCellsInRegion(
      x - boundingBox, x + boundingBox, 
      y - boundingBox, y + boundingBox
    );

    // Standard adjacency rule
    for (const neighbor of neighbors4) {
      const owner = cellMap.get(`${neighbor.x},${neighbor.y}`);
      if (owner === playerId) {
        return true;
      }
    }

    // Check for diagonal tunneling exception
    return await this.canTunnelDiagonally(x, y, playerId, cellMap);
  }

  /**
   * Diagonal tunneling mechanic from Territory game
   */
  private async canTunnelDiagonally(
    x: number, 
    y: number, 
    playerColour: string,
    cellMap: Map<string, string | null>
  ): Promise<boolean> {
    const diagonalNeighbors = [
      { x: x + 1, y: y + 1 }, // Bottom-right
      { x: x + 1, y: y - 1 }, // Top-right  
      { x: x - 1, y: y + 1 }, // Bottom-left
      { x: x - 1, y: y - 1 }  // Top-left
    ];

    // Check each diagonal neighbor
    for (const diagonal of diagonalNeighbors) {
      const diagonalOwner = cellMap.get(`${diagonal.x},${diagonal.y}`);
      
      // Must have a diagonally adjacent owned cell
      if (diagonalOwner === playerColour) {
        // Find the two 4-adjacent cells that form the "corner"
        const corner1 = { x: diagonal.x, y };      
        const corner2 = { x, y: diagonal.y };      
        
        const corner1Owner = cellMap.get(`${corner1.x},${corner1.y}`);
        const corner2Owner = cellMap.get(`${corner2.x},${corner2.y}`);
        
        // Both corner cells must be owned by opponents
        if (corner1Owner !== null && corner1Owner !== undefined && corner1Owner !== playerColour &&
            corner2Owner !== null && corner2Owner !== undefined && corner2Owner !== playerColour) {
          return true; // Diagonal tunneling allowed
        }
      }
    }

    return false;
  }

  /**
   * Apply territory move with all the sophisticated mechanics
   */
  async applyGridMove(x: number, y: number, playerColour: string): Promise<GridMoveResult> {
    const boundingBox = this.rules.gridOptions.maxBoundingBox || 30;
    const minX = x - boundingBox;
    const maxX = x + boundingBox;
    const minY = y - boundingBox;
    const maxY = y + boundingBox;

    const localCells = await this.getCellsInRegion(minX, maxX, minY, maxY);
    const targetCell = localCells.get(`${x},${y}`);
    
    const changedCells: GridCell[] = [];
    const processQueue: { x: number; y: number }[] = [];
    const processed = new Set<string>();

    // Check if cell already owned
    if (targetCell === playerColour) {
      return { success: false, error: 'Cell already owned by you' };
    }

    // Flipping opponent cells requires 5+ neighbors
    if (targetCell !== undefined && targetCell !== null) {
      const neighbors8 = this.get8Neighbors(x, y);
      let playerNeighborCount = 0;
      
      for (const n of neighbors8) {
        const neighborOwner = localCells.get(`${n.x},${n.y}`);
        if (neighborOwner === playerColour) {
          playerNeighborCount++;
        }
      }

      if (playerNeighborCount < 5) {
        return { success: false, error: 'Need 5+ neighbors to flip opponent cell' };
      }
    }

    // Place the initial cell
    localCells.set(`${x},${y}`, playerColour);
    changedCells.push({ x, y, owner: playerColour });
    
    // Queue neighbors for processing
    this.get8Neighbors(x, y).forEach(n => {
      processQueue.push(n);
    });

    // Process neighbor-based expansions
    while (processQueue.length > 0) {
      const current = processQueue.shift()!;
      const key = `${current.x},${current.y}`;
      
      if (processed.has(key)) continue;
      processed.add(key);

      const currentOwner = localCells.get(key);
      let shouldFlip = false;
      let newOwner = currentOwner;

      if (currentOwner === undefined || currentOwner === null) {
        // Empty cell - check for 3+ same neighbors
        const neighbors4 = this.get4Neighbors(current.x, current.y);
        const ownerCounts = new Map<string, number>();
        
        for (const n of neighbors4) {
          const owner = localCells.get(`${n.x},${n.y}`);
          if (owner !== undefined && owner !== null) {
            ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
          }
        }

        for (const [owner, count] of ownerCounts) {
          if (count >= 3) {
            shouldFlip = true;
            newOwner = owner;
            break;
          }
        }
      } else if (currentOwner !== playerColour) {
        // Opponent cell - check for 5+ same neighbors
        const neighbors8 = this.get8Neighbors(current.x, current.y);
        const ownerCounts = new Map<string, number>();
        
        for (const n of neighbors8) {
          const owner = localCells.get(`${n.x},${n.y}`);
          if (owner !== undefined && owner !== null) {
            ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
          }
        }

        for (const [owner, count] of ownerCounts) {
          if (count >= 5 && owner !== currentOwner) {
            shouldFlip = true;
            newOwner = owner;
            break;
          }
        }
      }

      if (shouldFlip && newOwner !== currentOwner) {
        localCells.set(key, newOwner || null);
        changedCells.push({ x: current.x, y: current.y, owner: newOwner || null });
        
        // Queue neighbors of flipped cell
        this.get8Neighbors(current.x, current.y).forEach(n => {
          const nKey = `${n.x},${n.y}`;
          if (!processed.has(nKey)) {
            processQueue.push(n);
          }
        });
      }
    }

    // Check for enclosed areas after neighbor-based expansion
    const enclosedCells = this.findEnclosedAreas(localCells, playerColour, boundingBox);
    
    // Add enclosed cells to changes
    enclosedCells.forEach(enclosedCell => {
      const key = `${enclosedCell.x},${enclosedCell.y}`;
      localCells.set(key, enclosedCell.owner || null);
      changedCells.push({
        x: enclosedCell.x,
        y: enclosedCell.y,
        owner: enclosedCell.owner || null,
        data: { ...enclosedCell.data, wasEnclosed: true }
      });
    });

    // Persist changes
    await this.saveCells(changedCells);
    await this.updateScores(changedCells);

    return {
      success: true,
      changedCells,
      affectedChunks: this.getAffectedChunks(changedCells)
    };
  }

  async calculateScore(): Promise<{ scores: Map<string, number>; totalCells?: number }> {
    // Implementation would query database for actual scores
    return { scores: new Map(), totalCells: 0 };
  }

  async checkWinCondition(): Promise<{ hasWinner: boolean; winner?: string; reason?: string }> {
    // Territory games typically don't have automatic win conditions
    return { hasWinner: false };
  }

  async getGameState(): Promise<TerritoryGameState> {
    const scores = await this.calculateScore();
    return {
      gameId: this.gameId,
      scores: scores.scores,
      totalCells: scores.totalCells || 0
    };
  }

  /**
   * Update scores based on cell changes
   */
  private async updateScores(changedCells: GridCell[]): Promise<void> {
    const colorCounts = new Map<string, number>();
    
    changedCells.forEach(cell => {
      if (cell.owner !== null && cell.owner !== undefined) {
        colorCounts.set(cell.owner, (colorCounts.get(cell.owner) || 0) + 1);
      }
    });

    // Implementation would update database scores
  }

  // Abstract method implementations
  protected async loadCells(_bounds: { minX: number; maxX: number; minY: number; maxY: number }): Promise<GridCell[]> {
    // Implementation would load from database
    return [];
  }

  protected async saveCells(_cells: GridCell[]): Promise<void> {
    // Implementation would save to database
  }
}

/**
 * Territory-specific move validator
 */
class TerritoryMoveValidator {
  async validate(_playerId: string, moveData: any, _gameState: any): Promise<import('@multiplayer-engine/core').ValidationResult> {
    // Basic validation
    if (typeof moveData.x !== 'number' || typeof moveData.y !== 'number') {
      return { isValid: false, error: 'Invalid coordinates' };
    }

    return { isValid: true };
  }
}