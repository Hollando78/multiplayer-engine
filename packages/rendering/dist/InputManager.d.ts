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
    position: {
        x: number;
        y: number;
    };
    worldPosition?: {
        x: number;
        y: number;
    };
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
export type InputEventType = 'tap' | 'doubleTap' | 'longPress' | 'dragStart' | 'drag' | 'dragEnd' | 'pinchStart' | 'pinch' | 'pinchEnd' | 'wheel' | 'keyDown' | 'keyUp' | 'mouseEnter' | 'mouseLeave';
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
export declare class InputManager {
    private element;
    private config;
    private eventHandlers;
    private activeTouches;
    private dragData;
    private pinchData;
    private lastTapTime;
    private longPressTimer;
    private worldToScreenTransform?;
    private screenToWorldTransform?;
    constructor(element: HTMLElement, config?: InputConfig);
    /**
     * Set coordinate transformation functions
     */
    setTransforms(screenToWorld?: (x: number, y: number) => {
        x: number;
        y: number;
    }, worldToScreen?: (x: number, y: number) => {
        x: number;
        y: number;
    }): void;
    /**
     * Add event listener
     */
    on(event: InputEventType, handler: (event: InputEvent) => void): void;
    /**
     * Remove event listener
     */
    off(event: InputEventType, handler: (event: InputEvent) => void): void;
    /**
     * Remove all event listeners for a specific event type
     */
    removeAllListeners(event?: InputEventType): void;
    /**
     * Get current drag state
     */
    getDragData(): DragData | null;
    /**
     * Get current pinch state
     */
    getPinchData(): PinchData | null;
    /**
     * Check if currently dragging
     */
    isDragging(): boolean;
    /**
     * Check if currently pinching
     */
    isPinching(): boolean;
    /**
     * Get number of active touches
     */
    getTouchCount(): number;
    /**
     * Setup DOM event listeners
     */
    private setupEventListeners;
    /**
     * Mouse event handlers
     */
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private handleWheel;
    private handleClick;
    private handleDoubleClick;
    private handleMouseEnter;
    private handleMouseLeave;
    /**
     * Touch event handlers
     */
    private handleTouchStart;
    private handleTouchMove;
    private handleTouchEnd;
    /**
     * Keyboard event handlers
     */
    private handleKeyDown;
    private handleKeyUp;
    /**
     * Drag handling
     */
    private startDrag;
    private updateDrag;
    private endDrag;
    /**
     * Pinch handling
     */
    private startPinch;
    private updatePinch;
    private endPinch;
    /**
     * Long press handling
     */
    private startLongPress;
    private cancelLongPress;
    /**
     * Utility methods
     */
    private updateActiveTouches;
    private getTouchDistance;
    private getTouchRotation;
    private getElementPosition;
    private getModifiers;
    private emit;
    /**
     * Clean up resources
     */
    destroy(): void;
}
//# sourceMappingURL=InputManager.d.ts.map