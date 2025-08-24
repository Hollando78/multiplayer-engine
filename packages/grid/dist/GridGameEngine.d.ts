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
export declare abstract class GridGameEngine<TGameState = any, TGameRules extends GridGameRules = GridGameRules> extends GameEngine<TGameState, GridMoveData, TGameRules> {
    protected grid: GridManager;
    protected chunkManager: ChunkManager;
    constructor(gameId: string, rules: TGameRules);
    /**
     * Grid-specific abstract methods
     */
    abstract canPlaceAt(x: number, y: number, playerId: string): Promise<boolean>;
    abstract applyGridMove(x: number, y: number, playerId: string): Promise<GridMoveResult>;
    /**
     * Standard move validation - delegates to canPlaceAt
     */
    validateMove(playerId: string, moveData: GridMoveData): Promise<boolean>;
    /**
     * Standard move application - delegates to applyGridMove
     */
    applyMove(playerId: string, moveData: GridMoveData): Promise<MoveResult>;
    /**
     * Get all cells in a rectangular region
     */
    getCellsInRegion(minX: number, maxX: number, minY: number, maxY: number): Promise<Map<string, string | null>>;
    /**
     * Get 4-connected neighbors
     */
    get4Neighbors(x: number, y: number): GridCoordinate[];
    /**
     * Get 8-connected neighbors (including diagonals)
     */
    get8Neighbors(x: number, y: number): GridCoordinate[];
    /**
     * Generic flood fill algorithm for finding connected regions
     */
    floodFill(startX: number, startY: number, predicate: (x: number, y: number, owner: string | null) => boolean, cellMap: Map<string, string | null>, bounds?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    }): FloodFillRegion;
    /**
     * Find enclosed areas that should be captured
     * This is the sophisticated algorithm from Territory game
     */
    findEnclosedAreas(cellMap: Map<string, string | null>, playerColour: string, _searchRadius?: number): GridCell[];
    /**
     * Flood fill to find a connected region and determine if it's enclosed
     */
    private floodFillRegion;
    /**
     * Get affected chunks from cell changes
     */
    getAffectedChunks(changedCells: GridCell[]): string[];
    protected abstract loadCells(bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    }): Promise<GridCell[]>;
    protected abstract saveCells(cells: GridCell[]): Promise<void>;
}
/**
 * Grid manager for coordinate and spatial operations
 */
export declare class GridManager {
    private options;
    constructor(options?: GridOptions);
    /**
     * Check if coordinates are within bounds (for finite grids)
     */
    isInBounds(x: number, y: number): boolean;
    /**
     * Calculate distance between two points
     */
    getDistance(x1: number, y1: number, x2: number, y2: number): number;
    /**
     * Get all cells within a radius
     */
    getCellsInRadius(centerX: number, centerY: number, radius: number): GridCoordinate[];
}
/**
 * Chunk manager for efficient grid operations
 */
export declare class ChunkManager {
    readonly chunkSize: number;
    constructor(chunkSize?: number);
    /**
     * Convert world coordinates to chunk coordinates
     */
    getChunkCoords(x: number, y: number): {
        chunkX: number;
        chunkY: number;
    };
    /**
     * Get all chunks that intersect with a bounding box
     */
    getChunksInBounds(minX: number, maxX: number, minY: number, maxY: number): string[];
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
//# sourceMappingURL=GridGameEngine.d.ts.map