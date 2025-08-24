/**
 * @multiplayer-engine/rendering
 * Universal rendering engine for multiplayer games
 *
 * Extracted from Territory Conquest's sophisticated client-side rendering system
 */
export * from './CanvasRenderer';
export * from './ViewportManager';
export * from './AnimationEngine';
export * from './ThemeEngine';
export * from './InputManager';
export type { CanvasConfig, RenderableCell, RenderState, ViewportState, AnimationState, RenderContext } from './CanvasRenderer';
export type { ViewportConfig, ViewportUpdate, ViewportEvent, ViewportEventType } from './ViewportManager';
export type { AnimationConfig, AnimationTarget, Animation, EasingFunction } from './AnimationEngine';
export type { ColorPalette, ThemeConfig, AccessibilityConfig } from './ThemeEngine';
export type { InputConfig, InputEvent, InputEventType, TouchPoint, DragData, PinchData } from './InputManager';
/**
 * Rendering utilities and helpers
 */
export declare const RenderingUtils: {
    /**
     * Create a pixel-perfect canvas with proper DPI scaling
     */
    createPixelPerfectCanvas(width: number, height: number): HTMLCanvasElement;
    /**
     * Convert RGB values to hex color
     */
    rgbToHex(r: number, g: number, b: number): string;
    /**
     * Convert hex color to RGB values
     */
    hexToRgb(hex: string): {
        r: number;
        g: number;
        b: number;
    } | null;
    /**
     * Interpolate between two colors
     */
    interpolateColors(color1: string, color2: string, factor: number): string;
    /**
     * Calculate distance between two points
     */
    distance(x1: number, y1: number, x2: number, y2: number): number;
    /**
     * Clamp a value between min and max
     */
    clamp(value: number, min: number, max: number): number;
    /**
     * Linear interpolation between two values
     */
    lerp(a: number, b: number, t: number): number;
    /**
     * Check if a point is inside a rectangle
     */
    pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean;
    /**
     * Check if a point is inside a circle
     */
    pointInCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean;
    /**
     * Format a number as a string with thousand separators
     */
    formatNumber(num: number): string;
    /**
     * Generate a random color
     */
    randomColor(): string;
    /**
     * Get a contrasting color (black or white) for a given background color
     */
    getContrastingColor(backgroundColor: string): string;
};
//# sourceMappingURL=index.d.ts.map