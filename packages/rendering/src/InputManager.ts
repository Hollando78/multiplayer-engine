/**
 * Universal input handling for touch/mouse/keyboard
 * Extracted from Territory Conquest's comprehensive input system
 */

export interface InputConfig {
  enableMouse?: boolean;
  enableTouch?: boolean;
  enableKeyboard?: boolean;
  preventContextMenu?: boolean;
  preventDefaultTouchBehavior?: boolean;
  longPressDelay?: number;
  doubleTapDelay?: number;
  dragDeadzone?: number;
}

export interface InputEvent {
  type: InputEventType;
  position: { x: number; y: number };
  worldPosition?: { x: number; y: number };
  button?: number;
  key?: string;
  modifiers?: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
  touches?: TouchPoint[];
  timestamp: number;
}

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  force?: number;
}

export type InputEventType = 
  | 'tap' 
  | 'doubleTap' 
  | 'longPress'
  | 'dragStart' 
  | 'drag' 
  | 'dragEnd'
  | 'pinchStart' 
  | 'pinch' 
  | 'pinchEnd'
  | 'wheel'
  | 'keyDown' 
  | 'keyUp'
  | 'mouseEnter'
  | 'mouseLeave';

export interface DragData {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  totalDeltaX: number;
  totalDeltaY: number;
  isDragging: boolean;
}

export interface PinchData {
  scale: number;
  centerX: number;
  centerY: number;
  rotation: number;
  initialDistance: number;
  currentDistance: number;
}

/**
 * Universal input manager for games
 */
export class InputManager {
  private element: HTMLElement;
  private config: Required<InputConfig>;
  private eventHandlers = new Map<InputEventType, ((event: InputEvent) => void)[]>();
  private activeTouches = new Map<number, TouchPoint>();
  private dragData: DragData | null = null;
  private pinchData: PinchData | null = null;
  private lastTapTime = 0;
  private longPressTimer: number | null = null;
  private worldToScreenTransform?: (x: number, y: number) => { x: number; y: number };
  private screenToWorldTransform?: (x: number, y: number) => { x: number; y: number };

  constructor(element: HTMLElement, config: InputConfig = {}) {
    this.element = element;
    
    this.config = {
      enableMouse: config.enableMouse !== false,
      enableTouch: config.enableTouch !== false,
      enableKeyboard: config.enableKeyboard !== false,
      preventContextMenu: config.preventContextMenu !== false,
      preventDefaultTouchBehavior: config.preventDefaultTouchBehavior !== false,
      longPressDelay: config.longPressDelay || 500,
      doubleTapDelay: config.doubleTapDelay || 300,
      dragDeadzone: config.dragDeadzone || 5
    };

    this.setupEventListeners();
  }

  /**
   * Set coordinate transformation functions
   */
  setTransforms(
    screenToWorld?: (x: number, y: number) => { x: number; y: number },
    worldToScreen?: (x: number, y: number) => { x: number; y: number }
  ): void {
    this.screenToWorldTransform = screenToWorld;
    this.worldToScreenTransform = worldToScreen;
  }

  /**
   * Add event listener
   */
  on(event: InputEventType, handler: (event: InputEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event listener
   */
  off(event: InputEventType, handler: (event: InputEvent) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Remove all event listeners for a specific event type
   */
  removeAllListeners(event?: InputEventType): void {
    if (event) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.clear();
    }
  }

  /**
   * Get current drag state
   */
  getDragData(): DragData | null {
    return this.dragData ? { ...this.dragData } : null;
  }

  /**
   * Get current pinch state
   */
  getPinchData(): PinchData | null {
    return this.pinchData ? { ...this.pinchData } : null;
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this.dragData?.isDragging || false;
  }

  /**
   * Check if currently pinching
   */
  isPinching(): boolean {
    return this.pinchData !== null;
  }

  /**
   * Get number of active touches
   */
  getTouchCount(): number {
    return this.activeTouches.size;
  }

  /**
   * Setup DOM event listeners
   */
  private setupEventListeners(): void {
    const { element, config } = this;

    // Mouse events
    if (config.enableMouse) {
      element.addEventListener('mousedown', this.handleMouseDown.bind(this));
      element.addEventListener('mousemove', this.handleMouseMove.bind(this));
      element.addEventListener('mouseup', this.handleMouseUp.bind(this));
      element.addEventListener('wheel', this.handleWheel.bind(this));
      element.addEventListener('click', this.handleClick.bind(this));
      element.addEventListener('dblclick', this.handleDoubleClick.bind(this));
      element.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
      element.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    }

    // Touch events
    if (config.enableTouch) {
      const touchOptions = { passive: !config.preventDefaultTouchBehavior };
      element.addEventListener('touchstart', this.handleTouchStart.bind(this), touchOptions);
      element.addEventListener('touchmove', this.handleTouchMove.bind(this), touchOptions);
      element.addEventListener('touchend', this.handleTouchEnd.bind(this), touchOptions);
      element.addEventListener('touchcancel', this.handleTouchEnd.bind(this), touchOptions);
    }

    // Keyboard events
    if (config.enableKeyboard) {
      // Make element focusable if it's not already
      if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '0');
      }
      
      element.addEventListener('keydown', this.handleKeyDown.bind(this));
      element.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    // Prevent context menu if requested
    if (config.preventContextMenu) {
      element.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  /**
   * Mouse event handlers
   */
  private handleMouseDown(e: MouseEvent): void {
    if (!this.config.enableMouse) return;

    const pos = this.getElementPosition(e.clientX, e.clientY);
    
    this.startDrag(pos.x, pos.y);
    this.startLongPress(pos.x, pos.y);

    this.emit('dragStart', {
      position: pos,
      button: e.button,
      modifiers: this.getModifiers(e)
    });
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.config.enableMouse) return;

    const pos = this.getElementPosition(e.clientX, e.clientY);
    
    if (this.dragData) {
      this.updateDrag(pos.x, pos.y);
      this.cancelLongPress();
      
      this.emit('drag', {
        position: pos,
        button: e.button,
        modifiers: this.getModifiers(e)
      });
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.config.enableMouse) return;

    const pos = this.getElementPosition(e.clientX, e.clientY);
    
    if (this.dragData) {
      this.emit('dragEnd', {
        position: pos,
        button: e.button,
        modifiers: this.getModifiers(e)
      });
      
      this.endDrag();
    }
    
    this.cancelLongPress();
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.config.enableMouse) return;

    const pos = this.getElementPosition(e.clientX, e.clientY);
    
    this.emit('wheel', {
      position: pos,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaZ: e.deltaZ,
      modifiers: this.getModifiers(e)
    } as any);
  }

  private handleClick(e: MouseEvent): void {
    if (!this.config.enableMouse || this.dragData?.isDragging) return;

    const pos = this.getElementPosition(e.clientX, e.clientY);
    
    this.emit('tap', {
      position: pos,
      button: e.button,
      modifiers: this.getModifiers(e)
    });
  }

  private handleDoubleClick(e: MouseEvent): void {
    if (!this.config.enableMouse) return;

    const pos = this.getElementPosition(e.clientX, e.clientY);
    
    this.emit('doubleTap', {
      position: pos,
      button: e.button,
      modifiers: this.getModifiers(e)
    });
  }

  private handleMouseEnter(e: MouseEvent): void {
    if (!this.config.enableMouse) return;

    const pos = this.getElementPosition(e.clientX, e.clientY);
    
    this.emit('mouseEnter', {
      position: pos,
      modifiers: this.getModifiers(e)
    });
  }

  private handleMouseLeave(e: MouseEvent): void {
    if (!this.config.enableMouse) return;

    const pos = this.getElementPosition(e.clientX, e.clientY);
    
    this.emit('mouseLeave', {
      position: pos,
      modifiers: this.getModifiers(e)
    });

    // Clean up any active interactions
    this.endDrag();
    this.cancelLongPress();
  }

  /**
   * Touch event handlers
   */
  private handleTouchStart(e: TouchEvent): void {
    if (!this.config.enableTouch) return;

    if (this.config.preventDefaultTouchBehavior) {
      e.preventDefault();
    }

    this.updateActiveTouches(e.touches);

    if (e.touches.length === 1) {
      // Single touch
      const touch = e.touches[0];
      const pos = this.getElementPosition(touch.clientX, touch.clientY);
      
      this.startDrag(pos.x, pos.y);
      this.startLongPress(pos.x, pos.y);
      
      // Check for double tap
      const now = Date.now();
      if (now - this.lastTapTime < this.config.doubleTapDelay) {
        this.emit('doubleTap', { position: pos });
      }
      this.lastTapTime = now;

      this.emit('dragStart', { position: pos });
      
    } else if (e.touches.length === 2) {
      // Two touches - start pinch
      this.endDrag();
      this.cancelLongPress();
      this.startPinch(e.touches[0], e.touches[1]);
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.config.enableTouch) return;

    if (this.config.preventDefaultTouchBehavior) {
      e.preventDefault();
    }

    this.updateActiveTouches(e.touches);

    if (e.touches.length === 1 && this.dragData) {
      // Single touch drag
      const touch = e.touches[0];
      const pos = this.getElementPosition(touch.clientX, touch.clientY);
      
      this.updateDrag(pos.x, pos.y);
      this.cancelLongPress();
      
      this.emit('drag', { position: pos });
      
    } else if (e.touches.length === 2 && this.pinchData) {
      // Two touch pinch
      this.updatePinch(e.touches[0], e.touches[1]);
      
      const centerPos = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
      const pos = this.getElementPosition(centerPos.x, centerPos.y);
      
      this.emit('pinch', { position: pos });
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.config.enableTouch) return;

    if (this.config.preventDefaultTouchBehavior) {
      e.preventDefault();
    }

    this.updateActiveTouches(e.touches);

    if (e.touches.length === 0) {
      // All touches ended
      if (this.dragData) {
        const wasDragging = this.dragData.isDragging;
        const pos = { x: this.dragData.currentX, y: this.dragData.currentY };
        
        this.emit('dragEnd', { position: pos });
        
        // If it wasn't really a drag, emit tap
        if (!wasDragging) {
          this.emit('tap', { position: pos });
        }
        
        this.endDrag();
      }
      
      if (this.pinchData) {
        const pos = { x: this.pinchData.centerX, y: this.pinchData.centerY };
        this.emit('pinchEnd', { position: pos });
        this.endPinch();
      }
      
      this.cancelLongPress();
      
    } else if (e.touches.length === 1 && this.pinchData) {
      // Went from pinch to single touch
      const pos = this.getElementPosition(e.touches[0].clientX, e.touches[0].clientY);
      
      this.emit('pinchEnd', { position: pos });
      this.endPinch();
      
      // Start new drag
      this.startDrag(pos.x, pos.y);
      this.emit('dragStart', { position: pos });
    }
  }

  /**
   * Keyboard event handlers
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.config.enableKeyboard) return;

    this.emit('keyDown', {
      position: { x: 0, y: 0 }, // No position for keyboard events
      key: e.key,
      code: e.code,
      modifiers: this.getModifiers(e)
    } as any);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (!this.config.enableKeyboard) return;

    this.emit('keyUp', {
      position: { x: 0, y: 0 }, // No position for keyboard events
      key: e.key,
      code: e.code,
      modifiers: this.getModifiers(e)
    } as any);
  }

  /**
   * Drag handling
   */
  private startDrag(x: number, y: number): void {
    this.dragData = {
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
      deltaX: 0,
      deltaY: 0,
      totalDeltaX: 0,
      totalDeltaY: 0,
      isDragging: false
    };
  }

  private updateDrag(x: number, y: number): void {
    if (!this.dragData) return;

    const deltaX = x - this.dragData.currentX;
    const deltaY = y - this.dragData.currentY;
    const totalDeltaX = x - this.dragData.startX;
    const totalDeltaY = y - this.dragData.startY;

    // Check if we've moved enough to be considered dragging
    if (!this.dragData.isDragging) {
      const distance = Math.sqrt(totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY);
      if (distance > this.config.dragDeadzone) {
        this.dragData.isDragging = true;
      }
    }

    this.dragData.currentX = x;
    this.dragData.currentY = y;
    this.dragData.deltaX = deltaX;
    this.dragData.deltaY = deltaY;
    this.dragData.totalDeltaX = totalDeltaX;
    this.dragData.totalDeltaY = totalDeltaY;
  }

  private endDrag(): void {
    this.dragData = null;
  }

  /**
   * Pinch handling
   */
  private startPinch(touch1: Touch, touch2: Touch): void {
    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;
    const center = this.getElementPosition(centerX, centerY);
    
    const distance = this.getTouchDistance(touch1, touch2);
    const rotation = this.getTouchRotation(touch1, touch2);

    this.pinchData = {
      scale: 1,
      centerX: center.x,
      centerY: center.y,
      rotation,
      initialDistance: distance,
      currentDistance: distance
    };

    this.emit('pinchStart', { position: center });
  }

  private updatePinch(touch1: Touch, touch2: Touch): void {
    if (!this.pinchData) return;

    const centerX = (touch1.clientX + touch2.clientX) / 2;
    const centerY = (touch1.clientY + touch2.clientY) / 2;
    const center = this.getElementPosition(centerX, centerY);
    
    const currentDistance = this.getTouchDistance(touch1, touch2);
    const rotation = this.getTouchRotation(touch1, touch2);
    
    this.pinchData.scale = currentDistance / this.pinchData.initialDistance;
    this.pinchData.centerX = center.x;
    this.pinchData.centerY = center.y;
    this.pinchData.rotation = rotation;
    this.pinchData.currentDistance = currentDistance;
  }

  private endPinch(): void {
    this.pinchData = null;
  }

  /**
   * Long press handling
   */
  private startLongPress(x: number, y: number): void {
    this.cancelLongPress();
    
    this.longPressTimer = window.setTimeout(() => {
      this.emit('longPress', { position: { x, y } });
    }, this.config.longPressDelay);
  }

  private cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /**
   * Utility methods
   */
  private updateActiveTouches(touches: TouchList): void {
    this.activeTouches.clear();
    
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      const pos = this.getElementPosition(touch.clientX, touch.clientY);
      
      this.activeTouches.set(touch.identifier, {
        id: touch.identifier,
        x: pos.x,
        y: pos.y,
        force: touch.force
      });
    }
  }

  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchRotation(touch1: Touch, touch2: Touch): number {
    return Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
  }

  private getElementPosition(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.element.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  private getModifiers(e: MouseEvent | KeyboardEvent): { shift: boolean; ctrl: boolean; alt: boolean; meta: boolean } {
    return {
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey
    };
  }

  private emit(type: InputEventType, data: Partial<InputEvent>): void {
    const handlers = this.eventHandlers.get(type);
    if (!handlers) return;

    const event: InputEvent = {
      type,
      position: { x: 0, y: 0 },
      timestamp: Date.now(),
      ...data
    };

    // Add world position if transform is available
    if (this.screenToWorldTransform && event.position) {
      event.worldPosition = this.screenToWorldTransform(event.position.x, event.position.y);
    }

    // Add touch data
    if (this.activeTouches.size > 0) {
      event.touches = Array.from(this.activeTouches.values());
    }

    for (const handler of handlers) {
      handler(event);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.cancelLongPress();
    this.eventHandlers.clear();
    this.activeTouches.clear();
    this.dragData = null;
    this.pinchData = null;
  }
}