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
    worldPosition?: {
        x: number;
        y: number;
    };
    screenPosition?: {
        x: number;
        y: number;
    };
    viewport: ViewportState;
}
/**
 * Universal viewport manager with touch and mouse support
 */
export declare class ViewportManager {
    private canvas;
    private config;
    private viewport;
    private isDragging;
    private dragStart;
    private touchData;
    private pinchData;
    private lastTapTime;
    private longPressTimer;
    private eventHandlers;
    private animationFrame;
    private targetViewport;
    constructor(canvas: HTMLCanvasElement, initialViewport: ViewportState, config?: ViewportConfig);
    /**
     * Get current viewport state
     */
    getViewport(): ViewportState;
    /**
     * Set viewport with optional smooth animation
     */
    setViewport(update: ViewportUpdate): void;
    /**
     * World coordinates to screen coordinates
     */
    worldToScreen(worldX: number, worldY: number): {
        x: number;
        y: number;
    };
    /**
     * Screen coordinates to world coordinates
     */
    screenToWorld(screenX: number, screenY: number): {
        x: number;
        y: number;
    };
    /**
     * Zoom in/out centered on a specific point
     */
    zoom(factor: number, centerX?: number, centerY?: number): void;
    /**
     * Pan the viewport by a delta amount
     */
    pan(deltaX: number, deltaY: number): void;
    /**
     * Center the viewport on a world position
     */
    centerOn(worldX: number, worldY: number, zoom?: number): void;
    /**
     * Fit a world region into the viewport
     */
    fitRegion(bounds: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    }, padding?: number): void;
    /**
     * Add event listener
     */
    on(event: ViewportEventType, handler: (event: ViewportEvent) => void): void;
    /**
     * Remove event listener
     */
    off(event: ViewportEventType, handler: (event: ViewportEvent) => void): void;
    /**
     * Setup DOM event listeners
     */
    private setupEventListeners;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private handleWheel;
    private handleClick;
    private handleTouchStart;
    private handleTouchMove;
    private handleTouchEnd;
    private getTouchDistance;
    private startLongPressTimer;
    private clearLongPressTimer;
    private startSmoothTransition;
    private emit;
    private emitViewportChanged;
    /**
     * Clean up resources
     */
    destroy(): void;
}
//# sourceMappingURL=ViewportManager.d.ts.map