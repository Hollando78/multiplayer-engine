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
export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: Required<CanvasConfig>;
  private animationId: number | null = null;
  private renderCallbacks: ((context: RenderContext) => void)[] = [];
  private isDestroyed = false;

  constructor(canvas: HTMLCanvasElement, config: CanvasConfig = {}) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = context;

    this.config = {
      cellSize: config.cellSize || 20,
      backgroundColor: config.backgroundColor || '#000000',
      gridColor: config.gridColor || '#333333',
      showGrid: config.showGrid !== false,
      gridFadeZoom: config.gridFadeZoom || 0.5,
      imageRendering: config.imageRendering || 'pixelated',
      devicePixelRatio: config.devicePixelRatio !== false
    };

    this.setupCanvas();
    this.setupResizing();
  }

  /**
   * Setup canvas with proper pixel ratio handling
   */
  private setupCanvas(): void {
    const { canvas, ctx, config } = this;
    
    // Set CSS styles
    canvas.style.imageRendering = config.imageRendering;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Handle device pixel ratio for crisp rendering
    if (config.devicePixelRatio) {
      const ratio = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      canvas.width = displayWidth * ratio;
      canvas.height = displayHeight * ratio;
      
      ctx.scale(ratio, ratio);
    } else {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
  }

  /**
   * Setup automatic canvas resizing
   */
  private setupResizing(): void {
    const resizeObserver = new ResizeObserver(() => {
      if (!this.isDestroyed) {
        this.setupCanvas();
        this.requestRender();
      }
    });
    
    resizeObserver.observe(this.canvas);
    
    // Store reference for cleanup
    (this.canvas as any)._resizeObserver = resizeObserver;
  }

  /**
   * World coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number, viewport: ViewportState): { x: number; y: number } {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    return {
      x: centerX + (worldX - viewport.x) * this.config.cellSize * viewport.zoom,
      y: centerY + (worldY - viewport.y) * this.config.cellSize * viewport.zoom
    };
  }

  /**
   * Screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number, viewport: ViewportState): { x: number; y: number } {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    return {
      x: Math.floor((screenX - centerX) / (this.config.cellSize * viewport.zoom) + viewport.x),
      y: Math.floor((screenY - centerY) / (this.config.cellSize * viewport.zoom) + viewport.y)
    };
  }

  /**
   * Get visible world bounds for the current viewport
   */
  getVisibleBounds(viewport: ViewportState): { minX: number; maxX: number; minY: number; maxY: number } {
    const visibleCells = Math.ceil(Math.max(this.canvas.width, this.canvas.height) / (this.config.cellSize * viewport.zoom)) + 2;
    const halfVisible = Math.floor(visibleCells / 2);

    return {
      minX: Math.floor(viewport.x - halfVisible),
      maxX: Math.ceil(viewport.x + halfVisible),
      minY: Math.floor(viewport.y - halfVisible),
      maxY: Math.ceil(viewport.y + halfVisible)
    };
  }

  /**
   * Clear the entire canvas
   */
  clear(): void {
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw grid lines if zoom level is appropriate
   */
  drawGrid(viewport: ViewportState): void {
    if (!this.config.showGrid || viewport.zoom < this.config.gridFadeZoom) return;

    const { ctx, config } = this;
    const bounds = this.getVisibleBounds(viewport);

    ctx.strokeStyle = config.gridColor;
    ctx.globalAlpha = Math.min(1, (viewport.zoom - config.gridFadeZoom + 0.2) / 0.7);
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const screen = this.worldToScreen(x, viewport.y, viewport);
      ctx.beginPath();
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x, this.canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines  
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      const screen = this.worldToScreen(viewport.x, y, viewport);
      ctx.beginPath();
      ctx.moveTo(0, screen.y);
      ctx.lineTo(this.canvas.width, screen.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1; // Reset alpha
  }

  /**
   * Draw a cell with optional animation effects
   */
  drawCell(
    cell: RenderableCell,
    viewport: ViewportState,
    animation?: AnimationState
  ): void {
    const screen = this.worldToScreen(cell.x, cell.y, viewport);
    const size = this.config.cellSize * viewport.zoom;

    let cellScale = 1;
    let cellAlpha = 1;

    // Apply animation effects
    if (animation) {
      const elapsed = Date.now() - animation.startTime - (animation.delay || 0);
      
      if (elapsed >= 0 && elapsed < animation.duration) {
        const progress = Math.min(elapsed / animation.duration, 1);
        
        switch (animation.type) {
          case 'place':
            cellScale = 0.1 + (0.9 * progress);
            cellAlpha = progress;
            break;
          case 'flip':
            cellScale = 1 + 0.3 * Math.sin(progress * Math.PI);
            break;
          case 'pulse':
            cellScale = 1 + 0.2 * Math.sin(progress * Math.PI * 2);
            break;
          case 'fadeIn':
            cellAlpha = progress;
            break;
          case 'fadeOut':
            cellAlpha = 1 - progress;
            break;
        }
      }
    }

    this.ctx.save();
    this.ctx.globalAlpha = cellAlpha;

    if (cellScale !== 1) {
      const centerX = screen.x + size / 2;
      const centerY = screen.y + size / 2;
      this.ctx.translate(centerX, centerY);
      this.ctx.scale(cellScale, cellScale);
      this.ctx.translate(-centerX, -centerY);
    }

    this.ctx.fillStyle = cell.color || '#ffffff';
    this.ctx.fillRect(screen.x, screen.y, size - 1, size - 1);

    this.ctx.restore();
  }

  /**
   * Register a custom render callback
   */
  addRenderCallback(callback: (context: RenderContext) => void): void {
    this.renderCallbacks.push(callback);
  }

  /**
   * Remove a render callback
   */
  removeRenderCallback(callback: (context: RenderContext) => void): void {
    const index = this.renderCallbacks.indexOf(callback);
    if (index !== -1) {
      this.renderCallbacks.splice(index, 1);
    }
  }

  /**
   * Render a complete frame
   */
  render(renderState: RenderState): void {
    const { viewport, cells, animations } = renderState;
    const bounds = this.getVisibleBounds(viewport);

    // Clear canvas
    this.clear();

    // Draw grid
    this.drawGrid(viewport);

    // Draw cells
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        const cellKey = `${x},${y}`;
        const cell = cells.get(cellKey);
        
        if (cell) {
          const animation = animations.get(cellKey);
          this.drawCell(cell, viewport, animation);
        }
      }
    }

    // Execute custom render callbacks
    const context: RenderContext = {
      canvas: this.canvas,
      ctx: this.ctx,
      viewport,
      config: this.config
    };

    for (const callback of this.renderCallbacks) {
      callback(context);
    }
  }

  /**
   * Request an animation frame render
   */
  requestRender(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.animationId = requestAnimationFrame(() => {
      this.animationId = null;
      // The actual render call should be made by the game logic
      // This just ensures the frame is scheduled
    });
  }

  /**
   * Get canvas bounds for hit testing
   */
  getCanvasBounds(): DOMRect {
    return this.canvas.getBoundingClientRect();
  }

  /**
   * Update renderer configuration
   */
  updateConfig(newConfig: Partial<CanvasConfig>): void {
    Object.assign(this.config, newConfig);
    this.setupCanvas();
    this.requestRender();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.isDestroyed = true;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Clean up resize observer
    const resizeObserver = (this.canvas as any)._resizeObserver;
    if (resizeObserver) {
      resizeObserver.disconnect();
      delete (this.canvas as any)._resizeObserver;
    }

    this.renderCallbacks.length = 0;
  }
}