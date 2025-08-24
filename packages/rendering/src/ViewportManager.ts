/**
 * Universal viewport management for zoom/pan/touch interactions
 * Extracted from Territory Conquest's comprehensive touch handling
 */

import { ViewportState } from './CanvasRenderer';

export interface ViewportConfig {
  minZoom?: number;
  maxZoom?: number;
  zoomSpeed?: number;
  dragDeadzone?: number;
  doubleTapZoom?: number;
  doubleTapDelay?: number;
  smoothDamping?: boolean;
  boundingBox?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | undefined;
}

export interface TouchData {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  timestamp: number;
}

export interface PinchData {
  touch1: TouchData;
  touch2: TouchData;
  initialDistance: number;
  initialZoom: number;
  centerX: number;
  centerY: number;
}

export interface ViewportUpdate {
  x?: number;
  y?: number;
  zoom?: number;
  smooth?: boolean;
}

export type ViewportEventType = 'viewportChanged' | 'tap' | 'doubleTap' | 'longPress';

export interface ViewportEvent {
  type: ViewportEventType;
  worldPosition?: { x: number; y: number };
  screenPosition?: { x: number; y: number };
  viewport: ViewportState;
}

/**
 * Universal viewport manager with touch and mouse support
 */
export class ViewportManager {
  private canvas: HTMLCanvasElement;
  private config: Omit<Required<ViewportConfig>, 'boundingBox'> & { boundingBox?: ViewportConfig['boundingBox'] };
  private viewport: ViewportState;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private touchData = new Map<number, TouchData>();
  private pinchData: PinchData | null = null;
  private lastTapTime = 0;
  private longPressTimer: number | null = null;
  private eventHandlers = new Map<ViewportEventType, ((event: ViewportEvent) => void)[]>();
  private animationFrame: number | null = null;
  private targetViewport: ViewportState | null = null;

  constructor(canvas: HTMLCanvasElement, initialViewport: ViewportState, config: ViewportConfig = {}) {
    this.canvas = canvas;
    this.viewport = { ...initialViewport };
    
    this.config = {
      minZoom: config.minZoom || 0.1,
      maxZoom: config.maxZoom || 5.0,
      zoomSpeed: config.zoomSpeed || 1.1,
      dragDeadzone: config.dragDeadzone || 5,
      doubleTapZoom: config.doubleTapZoom || 1.5,
      doubleTapDelay: config.doubleTapDelay || 300,
      smoothDamping: config.smoothDamping !== false,
      boundingBox: config.boundingBox
    };

    this.setupEventListeners();
  }

  /**
   * Get current viewport state
   */
  getViewport(): ViewportState {
    return { ...this.viewport };
  }

  /**
   * Set viewport with optional smooth animation
   */
  setViewport(update: ViewportUpdate): void {
    const newViewport = {
      x: update.x !== undefined ? update.x : this.viewport.x,
      y: update.y !== undefined ? update.y : this.viewport.y,
      zoom: update.zoom !== undefined ? update.zoom : this.viewport.zoom
    };

    // Apply constraints
    newViewport.zoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, newViewport.zoom));
    
    if (this.config.boundingBox) {
      newViewport.x = Math.max(this.config.boundingBox.minX, Math.min(this.config.boundingBox.maxX, newViewport.x));
      newViewport.y = Math.max(this.config.boundingBox.minY, Math.min(this.config.boundingBox.maxY, newViewport.y));
    }

    if (update.smooth && this.config.smoothDamping) {
      this.targetViewport = newViewport;
      this.startSmoothTransition();
    } else {
      this.viewport = newViewport;
      this.emitViewportChanged();
    }
  }

  /**
   * World coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    return {
      x: centerX + (worldX - this.viewport.x) * this.viewport.zoom,
      y: centerY + (worldY - this.viewport.y) * this.viewport.zoom
    };
  }

  /**
   * Screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    return {
      x: (screenX - centerX) / this.viewport.zoom + this.viewport.x,
      y: (screenY - centerY) / this.viewport.zoom + this.viewport.y
    };
  }

  /**
   * Zoom in/out centered on a specific point
   */
  zoom(factor: number, centerX?: number, centerY?: number): void {
    const oldZoom = this.viewport.zoom;
    const newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, oldZoom * factor));
    
    if (newZoom === oldZoom) return;

    // If no center provided, zoom to viewport center
    if (centerX === undefined || centerY === undefined) {
      this.setViewport({ zoom: newZoom });
      return;
    }

    // Convert screen point to world coordinates
    const worldPoint = this.screenToWorld(centerX, centerY);
    
    // Calculate new viewport position to keep the world point under the screen point
    const zoomRatio = newZoom / oldZoom;
    const newX = worldPoint.x + (this.viewport.x - worldPoint.x) / zoomRatio;
    const newY = worldPoint.y + (this.viewport.y - worldPoint.y) / zoomRatio;

    this.setViewport({ x: newX, y: newY, zoom: newZoom });
  }

  /**
   * Pan the viewport by a delta amount
   */
  pan(deltaX: number, deltaY: number): void {
    this.setViewport({
      x: this.viewport.x - deltaX / this.viewport.zoom,
      y: this.viewport.y - deltaY / this.viewport.zoom
    });
  }

  /**
   * Center the viewport on a world position
   */
  centerOn(worldX: number, worldY: number, zoom?: number): void {
    this.setViewport({
      x: worldX,
      y: worldY,
      zoom: zoom || this.viewport.zoom,
      smooth: true
    });
  }

  /**
   * Fit a world region into the viewport
   */
  fitRegion(bounds: { minX: number; maxX: number; minY: number; maxY: number }, padding = 1.1): void {
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    
    if (worldWidth <= 0 || worldHeight <= 0) return;

    const screenWidth = this.canvas.width;
    const screenHeight = this.canvas.height;
    
    const zoomX = screenWidth / (worldWidth * padding);
    const zoomY = screenHeight / (worldHeight * padding);
    const zoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, Math.min(zoomX, zoomY)));
    
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    this.setViewport({ x: centerX, y: centerY, zoom, smooth: true });
  }

  /**
   * Add event listener
   */
  on(event: ViewportEventType, handler: (event: ViewportEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  off(event: ViewportEventType, handler: (event: ViewportEvent) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Setup DOM event listeners
   */
  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));

    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button === 0) { // Left button
      this.isDragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      this.clearLongPressTimer();
      this.startLongPressTimer(e.clientX, e.clientY);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      const deltaX = e.clientX - this.dragStart.x;
      const deltaY = e.clientY - this.dragStart.y;
      
      this.pan(deltaX, deltaY);
      this.dragStart = { x: e.clientX, y: e.clientY };
      this.clearLongPressTimer();
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.style.cursor = 'default';
      this.clearLongPressTimer();
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const centerX = e.clientX - rect.left;
    const centerY = e.clientY - rect.top;
    
    const factor = e.deltaY > 0 ? 1 / this.config.zoomSpeed : this.config.zoomSpeed;
    this.zoom(factor, centerX, centerY);
  }

  private handleClick(e: MouseEvent): void {
    if (this.isDragging) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.screenToWorld(screenX, screenY);
    
    const now = Date.now();
    if (now - this.lastTapTime < this.config.doubleTapDelay) {
      // Double click detected
      this.emit('doubleTap', {
        screenPosition: { x: screenX, y: screenY },
        worldPosition: worldPos
      });
      
      // Zoom in on double click
      this.zoom(this.config.doubleTapZoom, screenX, screenY);
    } else {
      // Single click
      this.emit('tap', {
        screenPosition: { x: screenX, y: screenY },
        worldPosition: worldPos
      });
    }
    
    this.lastTapTime = now;
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const now = Date.now();
    
    // Clear existing touch data if starting fresh
    if (e.touches.length === 1) {
      this.touchData.clear();
      this.pinchData = null;
    }
    
    // Process each touch
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      this.touchData.set(touch.identifier, {
        id: touch.identifier,
        x,
        y,
        startX: x,
        startY: y,
        timestamp: now
      });
    }
    
    if (e.touches.length === 1) {
      // Single touch - start drag
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      this.isDragging = true;
      this.dragStart = { x: touch.clientX, y: touch.clientY };
      
      // Check for double tap
      if (now - this.lastTapTime < this.config.doubleTapDelay) {
        const worldPos = this.screenToWorld(x, y);
        this.emit('doubleTap', {
          screenPosition: { x, y },
          worldPosition: worldPos
        });
        this.zoom(this.config.doubleTapZoom, x, y);
      }
      
      this.lastTapTime = now;
      this.startLongPressTimer(x, y);
      
    } else if (e.touches.length === 2) {
      // Two fingers - start pinch
      this.isDragging = false;
      this.clearLongPressTimer();
      
      const touch1Data = this.touchData.get(e.touches[0].identifier)!;
      const touch2Data = this.touchData.get(e.touches[1].identifier)!;
      
      const distance = this.getTouchDistance(touch1Data, touch2Data);
      const centerX = (touch1Data.x + touch2Data.x) / 2;
      const centerY = (touch1Data.y + touch2Data.y) / 2;
      
      this.pinchData = {
        touch1: touch1Data,
        touch2: touch2Data,
        initialDistance: distance,
        initialZoom: this.viewport.zoom,
        centerX,
        centerY
      };
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    
    // Update touch data
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const touchData = this.touchData.get(touch.identifier);
      if (touchData) {
        touchData.x = touch.clientX - rect.left;
        touchData.y = touch.clientY - rect.top;
      }
    }
    
    if (e.touches.length === 1 && this.isDragging) {
      // Single finger drag
      const touch = e.touches[0];
      const deltaX = touch.clientX - this.dragStart.x;
      const deltaY = touch.clientY - this.dragStart.y;
      
      this.pan(deltaX, deltaY);
      this.dragStart = { x: touch.clientX, y: touch.clientY };
      this.clearLongPressTimer();
      
    } else if (e.touches.length === 2 && this.pinchData) {
      // Two finger pinch
      const touch1Data = this.touchData.get(e.touches[0].identifier)!;
      const touch2Data = this.touchData.get(e.touches[1].identifier)!;
      
      const currentDistance = this.getTouchDistance(touch1Data, touch2Data);
      const centerX = (touch1Data.x + touch2Data.x) / 2;
      const centerY = (touch1Data.y + touch2Data.y) / 2;
      
      // Calculate zoom
      const zoomFactor = currentDistance / this.pinchData.initialDistance;
      const newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, this.pinchData.initialZoom * zoomFactor));
      
      // Calculate pan to keep center point stable
      const worldCenter = this.screenToWorld(this.pinchData.centerX, this.pinchData.centerY);
      const zoomRatio = newZoom / this.viewport.zoom;
      
      this.setViewport({
        x: worldCenter.x + (this.viewport.x - worldCenter.x) / zoomRatio,
        y: worldCenter.y + (this.viewport.y - worldCenter.y) / zoomRatio,
        zoom: newZoom
      });
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    
    // Remove ended touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touchData.delete(touch.identifier);
    }
    
    if (e.touches.length === 0) {
      // All touches ended
      if (this.isDragging && e.changedTouches.length === 1) {
        // Check if this was a tap (minimal movement)
        const touch = e.changedTouches[0];
        const touchData = this.touchData.get(touch.identifier);
        
        if (touchData) {
          const distance = Math.sqrt(
            Math.pow(touch.clientX - rect.left - touchData.startX, 2) +
            Math.pow(touch.clientY - rect.top - touchData.startY, 2)
          );
          
          if (distance < this.config.dragDeadzone) {
            const worldPos = this.screenToWorld(touchData.startX, touchData.startY);
            this.emit('tap', {
              screenPosition: { x: touchData.startX, y: touchData.startY },
              worldPosition: worldPos
            });
          }
        }
      }
      
      this.isDragging = false;
      this.pinchData = null;
      this.clearLongPressTimer();
    }
  }

  private getTouchDistance(touch1: TouchData, touch2: TouchData): number {
    const dx = touch1.x - touch2.x;
    const dy = touch1.y - touch2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private startLongPressTimer(x: number, y: number): void {
    this.clearLongPressTimer();
    
    this.longPressTimer = window.setTimeout(() => {
      const worldPos = this.screenToWorld(x, y);
      this.emit('longPress', {
        screenPosition: { x, y },
        worldPosition: worldPos
      });
    }, 500);
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private startSmoothTransition(): void {
    if (!this.targetViewport || this.animationFrame) return;
    
    const animate = () => {
      if (!this.targetViewport) return;
      
      const current = this.viewport;
      const target = this.targetViewport;
      const damping = 0.15;
      
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const dZoom = target.zoom - current.zoom;
      
      // Check if close enough to target
      if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001 && Math.abs(dZoom) < 0.001) {
        this.viewport = target;
        this.targetViewport = null;
        this.animationFrame = null;
        this.emitViewportChanged();
        return;
      }
      
      // Apply damping
      this.viewport = {
        x: current.x + dx * damping,
        y: current.y + dy * damping,
        zoom: current.zoom + dZoom * damping
      };
      
      this.emitViewportChanged();
      this.animationFrame = requestAnimationFrame(animate);
    };
    
    this.animationFrame = requestAnimationFrame(animate);
  }

  private emit(type: ViewportEventType, data: Partial<ViewportEvent> = {}): void {
    const handlers = this.eventHandlers.get(type);
    if (!handlers) return;
    
    const event: ViewportEvent = {
      type,
      viewport: this.getViewport(),
      ...data
    };
    
    for (const handler of handlers) {
      handler(event);
    }
  }

  private emitViewportChanged(): void {
    this.emit('viewportChanged');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearLongPressTimer();
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    this.eventHandlers.clear();
    this.touchData.clear();
    this.pinchData = null;
  }
}