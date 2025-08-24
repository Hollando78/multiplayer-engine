/**
 * Universal animation engine with accessibility support
 * Extracted from Territory Conquest's animation system
 */
export interface AnimationConfig {
    duration: number;
    delay?: number;
    easing?: EasingFunction;
    repeat?: number | 'infinite';
    yoyo?: boolean;
    onStart?: () => void;
    onUpdate?: (progress: number, value: any) => void;
    onComplete?: () => void;
}
interface RequiredAnimationConfig {
    duration: number;
    delay: number;
    easing: EasingFunction;
    repeat: number | 'infinite';
    yoyo: boolean;
    onStart?: () => void;
    onUpdate?: (progress: number, value: any) => void;
    onComplete?: () => void;
}
export interface AnimationTarget {
    [key: string]: number | string | boolean;
}
export interface Animation {
    id: string;
    startTime: number;
    config: RequiredAnimationConfig;
    fromValues: AnimationTarget;
    toValues: AnimationTarget;
    currentValues: AnimationTarget;
    isActive: boolean;
    isCompleted: boolean;
    currentIteration: number;
    direction: 'forward' | 'reverse';
}
export type EasingFunction = (t: number) => number;
/**
 * Common easing functions
 */
export declare const Easing: {
    linear: (t: number) => number;
    easeInQuad: (t: number) => number;
    easeOutQuad: (t: number) => number;
    easeInOutQuad: (t: number) => number;
    easeInCubic: (t: number) => number;
    easeOutCubic: (t: number) => number;
    easeInOutCubic: (t: number) => number;
    easeInSine: (t: number) => number;
    easeOutSine: (t: number) => number;
    easeInOutSine: (t: number) => number;
    easeInElastic: (t: number) => number;
    easeOutElastic: (t: number) => number;
    easeInBack: (t: number) => number;
    easeOutBack: (t: number) => number;
    easeInBounce: (t: number) => number;
    easeOutBounce: (t: number) => number;
};
/**
 * Universal animation engine with accessibility support
 */
export declare class AnimationEngine {
    private animations;
    private animationFrame;
    private respectMotionPreference;
    private globalTimeScale;
    /**
     * Check if reduced motion is preferred by user
     */
    private get prefersReducedMotion();
    /**
     * Create and start an animation
     */
    animate(id: string, fromValues: AnimationTarget, toValues: AnimationTarget, config: AnimationConfig): void;
    /**
     * Stop an animation
     */
    stop(id: string, jumpToEnd?: boolean): void;
    /**
     * Stop all animations
     */
    stopAll(jumpToEnd?: boolean): void;
    /**
     * Check if an animation is running
     */
    isAnimating(id: string): boolean;
    /**
     * Get current animation values
     */
    getCurrentValues(id: string): AnimationTarget | null;
    /**
     * Set global animation time scale (useful for slow-motion effects)
     */
    setTimeScale(scale: number): void;
    /**
     * Enable/disable respect for motion preferences
     */
    setRespectMotionPreference(respect: boolean): void;
    /**
     * Create a chain of animations that run in sequence
     */
    animateSequence(id: string, steps: Array<{
        fromValues: AnimationTarget;
        toValues: AnimationTarget;
        config: AnimationConfig;
    }>): void;
    /**
     * Create parallel animations that run simultaneously
     */
    animateParallel(id: string, animations: Array<{
        id: string;
        fromValues: AnimationTarget;
        toValues: AnimationTarget;
        config: AnimationConfig;
    }>): void;
    /**
     * Create common preset animations
     */
    fadeIn(id: string, duration?: number, delay?: number): void;
    fadeOut(id: string, duration?: number, delay?: number): void;
    scaleIn(id: string, duration?: number, delay?: number): void;
    scaleOut(id: string, duration?: number, delay?: number): void;
    pulse(id: string, duration?: number, repeat?: "infinite"): void;
    shake(id: string, intensity?: number, duration?: number): void;
    bounce(id: string, height?: number, duration?: number): void;
    /**
     * Start the animation loop
     */
    private startAnimationLoop;
    /**
     * Stop the animation loop
     */
    private stopAnimationLoop;
    /**
     * Clean up all resources
     */
    destroy(): void;
}
export {};
//# sourceMappingURL=AnimationEngine.d.ts.map