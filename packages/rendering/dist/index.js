"use strict";
/**
 * @multiplayer-engine/rendering
 * Universal rendering engine for multiplayer games
 *
 * Extracted from Territory Conquest's sophisticated client-side rendering system
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderingUtils = void 0;
// Core rendering
__exportStar(require("./CanvasRenderer"), exports);
__exportStar(require("./ViewportManager"), exports);
__exportStar(require("./AnimationEngine"), exports);
__exportStar(require("./ThemeEngine"), exports);
__exportStar(require("./InputManager"), exports);
/**
 * Rendering utilities and helpers
 */
exports.RenderingUtils = {
    /**
     * Create a pixel-perfect canvas with proper DPI scaling
     */
    createPixelPerfectCanvas(width, height) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
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
    rgbToHex(r, g, b) {
        const toHex = (c) => {
            const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },
    /**
     * Convert hex color to RGB values
     */
    hexToRgb(hex) {
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
    interpolateColors(color1, color2, factor) {
        const rgb1 = exports.RenderingUtils.hexToRgb(color1);
        const rgb2 = exports.RenderingUtils.hexToRgb(color2);
        if (!rgb1 || !rgb2)
            return color1;
        const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
        const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
        const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);
        return exports.RenderingUtils.rgbToHex(r, g, b);
    },
    /**
     * Calculate distance between two points
     */
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },
    /**
     * Clamp a value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    /**
     * Linear interpolation between two values
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },
    /**
     * Check if a point is inside a rectangle
     */
    pointInRect(px, py, rx, ry, rw, rh) {
        return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    },
    /**
     * Check if a point is inside a circle
     */
    pointInCircle(px, py, cx, cy, radius) {
        return exports.RenderingUtils.distance(px, py, cx, cy) <= radius;
    },
    /**
     * Format a number as a string with thousand separators
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
    /**
     * Generate a random color
     */
    randomColor() {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        return exports.RenderingUtils.rgbToHex(r, g, b);
    },
    /**
     * Get a contrasting color (black or white) for a given background color
     */
    getContrastingColor(backgroundColor) {
        const rgb = exports.RenderingUtils.hexToRgb(backgroundColor);
        if (!rgb)
            return '#000000';
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }
};
//# sourceMappingURL=index.js.map