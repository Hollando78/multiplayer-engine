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
export const DefaultThemes: Record<string, ThemeConfig> = {
  light: {
    name: 'Light',
    colors: {
      primary: '#4ECDC4',
      secondary: '#45B7D1',
      accent: '#FF6B6B',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#212529',
      textDim: '#6c757d',
      border: '#dee2e6',
      grid: '#e9ecef',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
      info: '#17a2b8'
    },
    cellColors: [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#F4A460', '#98D8C8', '#FF8A80', '#80CBC4',
      '#90CAF9', '#C8E6C9', '#FFF59D', '#E1BEE7', '#FFCC80', '#B2DFDB'
    ]
  },
  
  dark: {
    name: 'Dark',
    colors: {
      primary: '#4ECDC4',
      secondary: '#45B7D1',
      accent: '#FF6B6B',
      background: '#121212',
      surface: '#1e1e1e',
      text: '#ffffff',
      textDim: '#b0b0b0',
      border: '#333333',
      grid: '#2a2a2a',
      success: '#4caf50',
      warning: '#ff9800',
      error: '#f44336',
      info: '#2196f3'
    },
    cellColors: [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#F4A460', '#98D8C8', '#FF8A80', '#80CBC4',
      '#90CAF9', '#C8E6C9', '#FFF59D', '#E1BEE7', '#FFCC80', '#B2DFDB'
    ]
  },

  highContrast: {
    name: 'High Contrast',
    colors: {
      primary: '#ffffff',
      secondary: '#ffff00',
      accent: '#00ffff',
      background: '#000000',
      surface: '#000000',
      text: '#ffffff',
      textDim: '#cccccc',
      border: '#ffffff',
      grid: '#444444',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00ffff'
    },
    cellColors: [
      '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff',
      '#00ffff', '#ffffff', '#808080', '#ffa500', '#800080',
      '#008080', '#800000', '#008000', '#000080', '#808000', '#c0c0c0'
    ]
  }
};

/**
 * Universal theme engine with accessibility support
 */
export class ThemeEngine {
  private currentTheme: ThemeConfig;
  private accessibilityConfig: AccessibilityConfig;
  private cssVariablePrefix: string;
  private mediaQueryListeners: MediaQueryList[] = [];
  private themeChangeCallbacks: ((theme: ThemeConfig) => void)[] = [];

  constructor(
    initialTheme: ThemeConfig = DefaultThemes.light,
    accessibilityConfig: Partial<AccessibilityConfig> = {},
    cssVariablePrefix = '--theme'
  ) {
    this.currentTheme = initialTheme;
    this.cssVariablePrefix = cssVariablePrefix;
    this.accessibilityConfig = {
      respectReducedMotion: true,
      respectHighContrast: true,
      respectColorScheme: true,
      minContrastRatio: 4.5,
      ...accessibilityConfig
    };

    this.setupAccessibilityListeners();
    this.applyTheme();
  }

  /**
   * Get the current theme
   */
  getCurrentTheme(): ThemeConfig {
    return { ...this.currentTheme };
  }

  /**
   * Set a new theme
   */
  setTheme(theme: ThemeConfig): void {
    this.currentTheme = theme;
    this.applyTheme();
    this.notifyThemeChange();
  }

  /**
   * Get a color from the current theme
   */
  getColor(colorKey: keyof ColorPalette): string {
    return this.currentTheme.colors[colorKey];
  }

  /**
   * Get a cell color by index
   */
  getCellColor(index: number): string {
    const cellColors = this.currentTheme.cellColors || DefaultThemes.light.cellColors!;
    return cellColors[index % cellColors.length];
  }

  /**
   * Get all cell colors
   */
  getCellColors(): string[] {
    return [...(this.currentTheme.cellColors || DefaultThemes.light.cellColors!)];
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme(): void {
    const isDark = this.currentTheme.name.toLowerCase().includes('dark');
    const newTheme = isDark ? DefaultThemes.light : DefaultThemes.dark;
    this.setTheme(newTheme);
  }

  /**
   * Calculate contrast ratio between two colors
   */
  getContrastRatio(color1: string, color2: string): number {
    const getLuminance = (color: string): number => {
      const rgb = this.hexToRgb(color);
      if (!rgb) return 0;

      const getRGB = (value: number): number => {
        value /= 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
      };

      return 0.2126 * getRGB(rgb.r) + 0.7152 * getRGB(rgb.g) + 0.0722 * getRGB(rgb.b);
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);

    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Check if a color combination meets accessibility standards
   */
  meetsAccessibilityStandards(foreground: string, background: string): boolean {
    const contrast = this.getContrastRatio(foreground, background);
    return contrast >= this.accessibilityConfig.minContrastRatio;
  }

  /**
   * Auto-adjust theme based on accessibility preferences
   */
  autoAdjustForAccessibility(): void {
    // Check for high contrast preference
    if (this.accessibilityConfig.respectHighContrast && this.prefersHighContrast()) {
      this.setTheme(DefaultThemes.highContrast);
      return;
    }

    // Check for color scheme preference
    if (this.accessibilityConfig.respectColorScheme) {
      const prefersDark = this.prefersDarkColorScheme();
      const currentIsDark = this.currentTheme.name.toLowerCase().includes('dark');
      
      if (prefersDark && !currentIsDark) {
        this.setTheme(DefaultThemes.dark);
      } else if (!prefersDark && currentIsDark && this.currentTheme.name !== 'High Contrast') {
        this.setTheme(DefaultThemes.light);
      }
    }
  }

  /**
   * Create a custom theme based on a base theme
   */
  createCustomTheme(
    name: string,
    baseTheme: ThemeConfig,
    overrides: Partial<ThemeConfig>
  ): ThemeConfig {
    return {
      ...baseTheme,
      name,
      ...overrides,
      colors: {
        ...baseTheme.colors,
        ...(overrides.colors || {})
      }
    };
  }

  /**
   * Generate a theme from a primary color
   */
  generateThemeFromColor(name: string, primaryColor: string, isDark = false): ThemeConfig {
    const baseTheme = isDark ? DefaultThemes.dark : DefaultThemes.light;
    const { h, s, l } = this.hexToHsl(primaryColor);

    // Generate complementary colors
    const secondary = this.hslToHex((h + 30) % 360, s, l);
    const accent = this.hslToHex((h + 180) % 360, s, Math.min(l + 0.1, 1));

    return this.createCustomTheme(name, baseTheme, {
      colors: {
        ...baseTheme.colors,
        primary: primaryColor,
        secondary,
        accent
      }
    });
  }

  /**
   * Add theme change listener
   */
  onThemeChange(callback: (theme: ThemeConfig) => void): void {
    this.themeChangeCallbacks.push(callback);
  }

  /**
   * Remove theme change listener
   */
  offThemeChange(callback: (theme: ThemeConfig) => void): void {
    const index = this.themeChangeCallbacks.indexOf(callback);
    if (index !== -1) {
      this.themeChangeCallbacks.splice(index, 1);
    }
  }

  /**
   * Check if user prefers reduced motion
   */
  prefersReducedMotion(): boolean {
    return this.accessibilityConfig.respectReducedMotion &&
           window.matchMedia && 
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Check if user prefers high contrast
   */
  prefersHighContrast(): boolean {
    return window.matchMedia && 
           window.matchMedia('(prefers-contrast: high)').matches;
  }

  /**
   * Check if user prefers dark color scheme
   */
  prefersDarkColorScheme(): boolean {
    return window.matchMedia && 
           window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Apply the current theme to CSS variables
   */
  private applyTheme(): void {
    const root = document.documentElement;
    const { colors } = this.currentTheme;

    // Apply color variables
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`${this.cssVariablePrefix}-${this.kebabCase(key)}`, value);
    }

    // Apply additional properties
    if (this.currentTheme.fonts) {
      const fonts = this.currentTheme.fonts;
      if (fonts.primary) {
        root.style.setProperty(`${this.cssVariablePrefix}-font-primary`, fonts.primary);
      }
      if (fonts.monospace) {
        root.style.setProperty(`${this.cssVariablePrefix}-font-mono`, fonts.monospace);
      }
    }

    // Apply spacing
    if (this.currentTheme.spacing) {
      for (const [key, value] of Object.entries(this.currentTheme.spacing)) {
        root.style.setProperty(`${this.cssVariablePrefix}-spacing-${key}`, `${value}px`);
      }
    }

    // Apply border radius
    if (this.currentTheme.borderRadius) {
      for (const [key, value] of Object.entries(this.currentTheme.borderRadius)) {
        root.style.setProperty(`${this.cssVariablePrefix}-radius-${key}`, `${value}px`);
      }
    }

    // Set theme name attribute
    root.setAttribute('data-theme', this.currentTheme.name.toLowerCase().replace(/\s+/g, '-'));
  }

  /**
   * Setup accessibility media query listeners
   */
  private setupAccessibilityListeners(): void {
    if (!window.matchMedia) return;

    const listeners = [
      {
        query: '(prefers-color-scheme: dark)',
        handler: () => this.autoAdjustForAccessibility()
      },
      {
        query: '(prefers-contrast: high)',
        handler: () => this.autoAdjustForAccessibility()
      }
    ];

    for (const { query, handler } of listeners) {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', handler);
      this.mediaQueryListeners.push(mql);
    }
  }

  /**
   * Notify all theme change listeners
   */
  private notifyThemeChange(): void {
    for (const callback of this.themeChangeCallbacks) {
      callback(this.currentTheme);
    }
  }

  /**
   * Convert camelCase to kebab-case
   */
  private kebabCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Convert hex color to HSL
   */
  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return { h: 0, s: 0, l: 0 };

    const { r, g, b } = rgb;
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
        case gNorm: h = (bNorm - rNorm) / d + 2; break;
        case bNorm: h = (rNorm - gNorm) / d + 4; break;
      }
      h /= 6;
    }

    return { h: h * 360, s, l };
  }

  /**
   * Convert HSL color to hex
   */
  private hslToHex(h: number, s: number, l: number): string {
    const hueToRgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const hNorm = h / 360;
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hueToRgb(p, q, hNorm + 1/3);
      g = hueToRgb(p, q, hNorm);
      b = hueToRgb(p, q, hNorm - 1/3);
    }

    const toHex = (c: number): string => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Remove media query listeners
    for (const mql of this.mediaQueryListeners) {
      mql.removeEventListener('change', this.autoAdjustForAccessibility);
    }
    this.mediaQueryListeners.length = 0;
    this.themeChangeCallbacks.length = 0;
  }
}