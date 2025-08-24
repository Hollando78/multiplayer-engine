/**
 * @multiplayer-engine/rendering
 * Universal rendering engine for multiplayer games
 * 
 * Extracted from Territory Conquest's sophisticated client-side rendering system
 */

// Core rendering
export * from './CanvasRenderer';
export * from './ViewportManager';
export * from './AnimationEngine';
export * from './ThemeEngine';
export * from './InputManager';

// Re-export common types for convenience
export type {
  CanvasConfig,
  RenderableCell,
  RenderState,
  ViewportState,
  AnimationState,
  RenderContext
} from './CanvasRenderer';

export type {
  ViewportConfig,
  ViewportUpdate,
  ViewportEvent,
  ViewportEventType
} from './ViewportManager';

export type {
  AnimationConfig,
  AnimationTarget,
  Animation,
  EasingFunction
} from './AnimationEngine';

export type {
  ColorPalette,
  ThemeConfig,
  AccessibilityConfig
} from './ThemeEngine';

export type {
  InputConfig,
  InputEvent,
  InputEventType,
  TouchPoint,
  DragData,
  PinchData
} from './InputManager';

/**
 * Rendering utilities and helpers
 */
export const RenderingUtils = {
  /**
   * Create a pixel-perfect canvas with proper DPI scaling
   */
  createPixelPerfectCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const ratio = window.devicePixelRatio || 1;
    
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    ctx.scale(ratio, ratio);
    
    return canvas;
  },

  /**
   * Convert RGB values to hex color
   */
  rgbToHex(r: number, g: number, b: number): string {
    const toHex = (c: number): string => {
      const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  /**
   * Convert hex color to RGB values
   */
  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  /**
   * Interpolate between two colors
   */
  interpolateColors(color1: string, color2: string, factor: number): string {
    const rgb1 = RenderingUtils.hexToRgb(color1);
    const rgb2 = RenderingUtils.hexToRgb(color2);
    
    if (!rgb1 || !rgb2) return color1;
    
    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);
    
    return RenderingUtils.rgbToHex(r, g, b);
  },

  /**
   * Calculate distance between two points
   */
  distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /**
   * Clamp a value between min and max
   */
  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Linear interpolation between two values
   */
  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },

  /**
   * Check if a point is inside a rectangle
   */
  pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  },

  /**
   * Check if a point is inside a circle
   */
  pointInCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean {
    return RenderingUtils.distance(px, py, cx, cy) <= radius;
  },

  /**
   * Format a number as a string with thousand separators
   */
  formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  /**
   * Generate a random color
   */
  randomColor(): string {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return RenderingUtils.rgbToHex(r, g, b);
  },

  /**
   * Get a contrasting color (black or white) for a given background color
   */
  getContrastingColor(backgroundColor: string): string {
    const rgb = RenderingUtils.hexToRgb(backgroundColor);
    if (!rgb) return '#000000';
    
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }
};