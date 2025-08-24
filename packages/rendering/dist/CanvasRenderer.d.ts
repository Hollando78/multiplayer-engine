/**
 * Universal canvas rendering engine for multiplayer games
 * Extracted from Territory Conquest's sophisticated rendering pipeline
 */
export interface CanvasConfig {
    cellSize?: number;
    backgroundColor?: string;
    gridColor?: string;
    showGrid?: boolean;
    gridFadeZoom?: number;
    imageRendering?: 'auto' | 'pixelated' | 'crisp-edges';
    devicePixelRatio?: boolean;
}
export interface RenderableCell {
    x: number;
    y: number;
    color?: string;
    data?: any;
}
export interface RenderState {
    cells: Map<string, RenderableCell>;
    viewport: ViewportState;
    animations: Map<string, AnimationState>;
}
export interface ViewportState {
    x: number;
    y: number;
    zoom: number;
}
export interface AnimationState {
    type: string;
    startTime: number;
    duration: number;
    delay?: number;
    data?: any;
}
export interface RenderContext {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    viewport: ViewportState;
    config: Required<CanvasConfig>;
}
/**
 * Universal canvas renderer with game-agnostic pipeline
 */
export declare class CanvasRenderer {
    private canvas;
    private ctx;
    private config;
    private animationId;
    private renderCallbacks;
    private isDestroyed;
    constructor(canvas: HTMLCanvasElement, config?: CanvasConfig);
    /**
     * Setup canvas with proper pixel ratio handling
     */
    private setupCanvas;
    /**
     * Setup automatic canvas resizing
     */
    private setupResizing;
    /**
     * World coordinates to screen coordinates
     */
    worldToScreen(worldX: number, worldY: number, viewport: ViewportState): {
        x: number;
        y: number;
    };
    /**
     * Screen coordinates to world coordinates
     */
    screenToWorld(screenX: number, screenY: number, viewport: ViewportState): {
        x: number;
        y: number;
    };
    /**
     * Get visible world bounds for the current viewport
     */
    getVisibleBounds(viewport: ViewportState): {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };
    /**
     * Clear the entire canvas
     */
    clear(): void;
    /**
     * Draw grid lines if zoom level is appropriate
     */
    drawGrid(viewport: ViewportState): void;
    /**
     * Draw a cell with optional animation effects
     */
    drawCell(cell: RenderableCell, viewport: ViewportState, animation?: AnimationState): void;
    /**
     * Register a custom render callback
     */
    addRenderCallback(callback: (context: RenderContext) => void): void;
    /**
     * Remove a render callback
     */
    removeRenderCallback(callback: (context: RenderContext) => void): void;
    /**
     * Render a complete frame
     */
    render(renderState: RenderState): void;
    /**
     * Request an animation frame render
     */
    requestRender(): void;
    /**
     * Get canvas bounds for hit testing
     */
    getCanvasBounds(): DOMRect;
    /**
     * Update renderer configuration
     */
    updateConfig(newConfig: Partial<CanvasConfig>): void;
    /**
     * Clean up resources
     */
    destroy(): void;
}
//# sourceMappingURL=CanvasRenderer.d.ts.map