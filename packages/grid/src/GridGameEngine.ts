import { GameEngine, MoveResult } from '@multiplayer-engine/core';

/**
 * GridGameEngine - Specialized engine for grid-based games
 * Provides spatial algorithms, flood-fill, and chunk management
 */

export interface GridOptions {
  infinite?: boolean;
  width?: number;
  height?: number;
  chunkSize?: number;
  maxBoundingBox?: number;
}

export interface GridCoordinate {
  x: number;
  y: number;
}

export interface GridCell {
  x: number;
  y: number;
  owner?: string | null;
  data?: Record<string, any>;
}

export interface GridMoveData {
  x: number;
  y: number;
  action?: string;
  data?: Record<string, any>;
}

export interface FloodFillRegion {
  cells: GridCoordinate[];
  isEnclosed: boolean;
  owner?: string | null;
}

export interface ChunkData {
  chunkX: number;
  chunkY: number;
  cells: Map<string, GridCell>;
}

/**
 * Abstract base class for grid-based games
 */
export abstract class GridGameEngine<
  TGameState = any,
  TGameRules extends GridGameRules = GridGameRules
> extends GameEngine<TGameState, GridMoveData, TGameRules> {
  
  protected grid: GridManager;
  protected chunkManager: ChunkManager;

  constructor(gameId: string, rules: TGameRules) {
    super(gameId, rules);
    this.grid = new GridManager(rules.gridOptions);
    this.chunkManager = new ChunkManager(rules.gridOptions.chunkSize || 64);
  }

  /**
   * Grid-specific abstract methods
   */
  abstract canPlaceAt(x: number, y: number, playerId: string): Promise<boolean>;
  abstract applyGridMove(x: number, y: number, playerId: string): Promise<GridMoveResult>;

  /**
   * Standard move validation - delegates to canPlaceAt
   */
  async validateMove(playerId: string, moveData: GridMoveData): Promise<boolean> {
    return await this.canPlaceAt(moveData.x, moveData.y, playerId);
  }

  /**
   * Standard move application - delegates to applyGridMove
   */
  async applyMove(playerId: string, moveData: GridMoveData): Promise<MoveResult> {
    const result = await this.applyGridMove(moveData.x, moveData.y, playerId);
    return {
      success: result.success,
      error: result.error,
      changedCells: result.changedCells,
      affectedChunks: result.affectedChunks
    };
  }

  /**
   * Get all cells in a rectangular region
   */
  async getCellsInRegion(minX: number, maxX: number, minY: number, maxY: number): Promise<Map<string, string | null>> {
    const cells = await this.loadCells({ minX, maxX, minY, maxY });
    const cellMap = new Map<string, string | null>();
    
    cells.forEach(cell => {
      cellMap.set(`${cell.x},${cell.y}`, cell.owner || null);
    });
    
    return cellMap;
  }

  /**
   * Get 4-connected neighbors
   */
  get4Neighbors(x: number, y: number): GridCoordinate[] {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];
  }

  /**
   * Get 8-connected neighbors (including diagonals)
   */
  get8Neighbors(x: number, y: number): GridCoordinate[] {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
      { x: x + 1, y: y + 1 },
      { x: x + 1, y: y - 1 },
      { x: x - 1, y: y + 1 },
      { x: x - 1, y: y - 1 }
    ];
  }

  /**
   * Generic flood fill algorithm for finding connected regions
   */
  floodFill(
    startX: number, 
    startY: number, 
    predicate: (x: number, y: number, owner: string | null) => boolean,
    cellMap: Map<string, string | null>,
    bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  ): FloodFillRegion {
    const region: GridCoordinate[] = [];
    const visited = new Set<string>();
    const queue: GridCoordinate[] = [{ x: startX, y: startY }];
    const startKey = `${startX},${startY}`;
    let isEnclosed = true;
    
    const startOwner = cellMap.get(startKey) || null;
    visited.add(startKey);
    
    const MAX_REGION_SIZE = 500; // Prevent infinite loops
    
    while (queue.length > 0 && region.length < MAX_REGION_SIZE) {
      const current = queue.shift()!;
      region.push(current);
      
      // Check if we've hit boundaries (means not enclosed if infinite grid)
      if (bounds && (
        current.x <= bounds.minX || current.x >= bounds.maxX || 
        current.y <= bounds.minY || current.y >= bounds.maxY
      )) {
        isEnclosed = false;
      }
      
      // Check 4-connected neighbors
      const neighbors = this.get4Neighbors(current.x, current.y);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;
        
        if (visited.has(neighborKey)) continue;
        
        const neighborOwner = cellMap.get(neighborKey) || null;
        
        // Apply predicate to determine if we should include this neighbor
        if (predicate(neighbor.x, neighbor.y, neighborOwner)) {
          visited.add(neighborKey);
          queue.push(neighbor);
        }
      }
    }
    
    if (region.length >= MAX_REGION_SIZE) {
      isEnclosed = false;
    }
    
    return { cells: region, isEnclosed, owner: startOwner };
  }

  /**
   * Find enclosed areas that should be captured
   * This is the sophisticated algorithm from Territory game
   */
  findEnclosedAreas(
    cellMap: Map<string, string | null>, 
    playerColour: string, 
    _searchRadius: number = 25
  ): GridCell[] {
    const enclosedCells: GridCell[] = [];
    const processedCells = new Set<string>();
    
    // Get bounds of the search area
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    cellMap.forEach((_owner, key) => {
      const [x, y] = key.split(',').map(Number);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    
    // Expand search bounds slightly
    minX -= 2;
    maxX += 2;
    minY -= 2;
    maxY += 2;
    
    // Check every cell in the bounded region
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        
        if (processedCells.has(key)) continue;
        const owner = cellMap.get(key);
        if (owner === playerColour) continue;
        
        // Flood fill from this position to find connected region
        const region = this.floodFillRegion(cellMap, x, y, playerColour, minX, maxX, minY, maxY);
        
        // Mark all cells in region as processed
        region.cells.forEach(cell => {
          processedCells.add(`${cell.x},${cell.y}`);
        });
        
        // If region is enclosed, add to conversion list
        if (region.isEnclosed) {
          region.cells.forEach(cell => {
            enclosedCells.push({
              x: cell.x,
              y: cell.y,
              owner: playerColour,
              data: { oldOwner: cellMap.get(`${cell.x},${cell.y}`) }
            });
          });
        }
      }
    }
    
    return enclosedCells;
  }

  /**
   * Flood fill to find a connected region and determine if it's enclosed
   */
  private floodFillRegion(
    cellMap: Map<string, string | null>,
    startX: number,
    startY: number,
    playerColour: string,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): FloodFillRegion {
    return this.floodFill(
      startX,
      startY,
      (_x, _y, owner) => owner !== playerColour, // Include non-player cells
      cellMap,
      { minX, maxX, minY, maxY }
    );
  }

  /**
   * Get affected chunks from cell changes
   */
  getAffectedChunks(changedCells: GridCell[]): string[] {
    const chunkSize = this.chunkManager.chunkSize;
    const chunks = new Set<string>();
    
    changedCells.forEach(cell => {
      const chunkX = Math.floor(cell.x / chunkSize);
      const chunkY = Math.floor(cell.y / chunkSize);
      chunks.add(`${chunkX},${chunkY}`);
    });
    
    return Array.from(chunks);
  }

  // Abstract methods for persistence
  protected abstract loadCells(bounds: { minX: number; maxX: number; minY: number; maxY: number }): Promise<GridCell[]>;
  protected abstract saveCells(cells: GridCell[]): Promise<void>;
}

/**
 * Grid manager for coordinate and spatial operations
 */
export class GridManager {
  private options: GridOptions;

  constructor(options: GridOptions = {}) {
    this.options = {
      infinite: true,
      chunkSize: 64,
      maxBoundingBox: 30,
      ...options
    };
  }

  /**
   * Check if coordinates are within bounds (for finite grids)
   */
  isInBounds(x: number, y: number): boolean {
    if (this.options.infinite) return true;
    
    return x >= 0 && x < (this.options.width || 0) &&
           y >= 0 && y < (this.options.height || 0);
  }

  /**
   * Calculate distance between two points
   */
  getDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  /**
   * Get all cells within a radius
   */
  getCellsInRadius(centerX: number, centerY: number, radius: number): GridCoordinate[] {
    const cells: GridCoordinate[] = [];
    const radiusSquared = radius * radius;
    
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        if (this.isInBounds(x, y)) {
          const distanceSquared = (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY);
          if (distanceSquared <= radiusSquared) {
            cells.push({ x, y });
          }
        }
      }
    }
    
    return cells;
  }
}

/**
 * Chunk manager for efficient grid operations
 */
export class ChunkManager {
  public readonly chunkSize: number;

  constructor(chunkSize: number = 64) {
    this.chunkSize = chunkSize;
  }

  /**
   * Convert world coordinates to chunk coordinates
   */
  getChunkCoords(x: number, y: number): { chunkX: number; chunkY: number } {
    return {
      chunkX: Math.floor(x / this.chunkSize),
      chunkY: Math.floor(y / this.chunkSize)
    };
  }

  /**
   * Get all chunks that intersect with a bounding box
   */
  getChunksInBounds(minX: number, maxX: number, minY: number, maxY: number): string[] {
    const chunks: string[] = [];
    
    const minChunkX = Math.floor(minX / this.chunkSize);
    const maxChunkX = Math.floor(maxX / this.chunkSize);
    const minChunkY = Math.floor(minY / this.chunkSize);
    const maxChunkY = Math.floor(maxY / this.chunkSize);
    
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
      for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
        chunks.push(`${chunkX},${chunkY}`);
      }
    }
    
    return chunks;
  }
}

/**
 * Type definitions
 */
export interface GridGameRules {
  gridOptions: GridOptions;
  resources?: any;
}

export interface GridMoveResult extends MoveResult {
  changedCells?: GridCell[];
  affectedChunks?: string[];
  enclosedRegions?: FloodFillRegion[];
}