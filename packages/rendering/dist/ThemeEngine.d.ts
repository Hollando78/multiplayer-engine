/**
 * Universal theme system with accessibility support
 * Extracted from Territory Conquest's comprehensive theming system
 */
export interface ColorPalette {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textDim: string;
    border: string;
    grid: string;
    success: string;
    warning: string;
    error: string;
    info: string;
}
export interface ThemeConfig {
    name: string;
    colors: ColorPalette;
    cellColors?: string[];
    fonts?: {
        primary?: string;
        monospace?: string;
    };
    spacing?: {
        xs?: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
    };
    borderRadius?: {
        sm?: number;
        md?: number;
        lg?: number;
    };
    shadows?: {
        sm?: string;
        md?: string;
        lg?: string;
    };
    animations?: {
        fast?: number;
        normal?: number;
        slow?: number;
    };
}
export interface AccessibilityConfig {
    respectReducedMotion: boolean;
    respectHighContrast: boolean;
    respectColorScheme: boolean;
    minContrastRatio: number;
}
/**
 * Predefined themes based on Territory's design system
 */
export declare const DefaultThemes: Record<string, ThemeConfig>;
/**
 * Universal theme engine with accessibility support
 */
export declare class ThemeEngine {
    private currentTheme;
    private accessibilityConfig;
    private cssVariablePrefix;
    private mediaQueryListeners;
    private themeChangeCallbacks;
    constructor(initialTheme?: ThemeConfig, accessibilityConfig?: Partial<AccessibilityConfig>, cssVariablePrefix?: string);
    /**
     * Get the current theme
     */
    getCurrentTheme(): ThemeConfig;
    /**
     * Set a new theme
     */
    setTheme(theme: ThemeConfig): void;
    /**
     * Get a color from the current theme
     */
    getColor(colorKey: keyof ColorPalette): string;
    /**
     * Get a cell color by index
     */
    getCellColor(index: number): string;
    /**
     * Get all cell colors
     */
    getCellColors(): string[];
    /**
     * Toggle between light and dark theme
     */
    toggleTheme(): void;
    /**
     * Calculate contrast ratio between two colors
     */
    getContrastRatio(color1: string, color2: string): number;
    /**
     * Check if a color combination meets accessibility standards
     */
    meetsAccessibilityStandards(foreground: string, background: string): boolean;
    /**
     * Auto-adjust theme based on accessibility preferences
     */
    autoAdjustForAccessibility(): void;
    /**
     * Create a custom theme based on a base theme
     */
    createCustomTheme(name: string, baseTheme: ThemeConfig, overrides: Partial<ThemeConfig>): ThemeConfig;
    /**
     * Generate a theme from a primary color
     */
    generateThemeFromColor(name: string, primaryColor: string, isDark?: boolean): ThemeConfig;
    /**
     * Add theme change listener
     */
    onThemeChange(callback: (theme: ThemeConfig) => void): void;
    /**
     * Remove theme change listener
     */
    offThemeChange(callback: (theme: ThemeConfig) => void): void;
    /**
     * Check if user prefers reduced motion
     */
    prefersReducedMotion(): boolean;
    /**
     * Check if user prefers high contrast
     */
    prefersHighContrast(): boolean;
    /**
     * Check if user prefers dark color scheme
     */
    prefersDarkColorScheme(): boolean;
    /**
     * Apply the current theme to CSS variables
     */
    private applyTheme;
    /**
     * Setup accessibility media query listeners
     */
    private setupAccessibilityListeners;
    /**
     * Notify all theme change listeners
     */
    private notifyThemeChange;
    /**
     * Convert camelCase to kebab-case
     */
    private kebabCase;
    /**
     * Convert hex color to RGB
     */
    private hexToRgb;
    /**
     * Convert hex color to HSL
     */
    private hexToHsl;
    /**
     * Convert HSL color to hex
     */
    private hslToHex;
    /**
     * Clean up resources
     */
    destroy(): void;
}
//# sourceMappingURL=ThemeEngine.d.ts.map