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
export const Easing = {
  linear: (t: number): number => t,
  
  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => (--t) * t * t + 1,
  easeInOutCubic: (t: number): number => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  
  easeInSine: (t: number): number => 1 - Math.cos(t * Math.PI / 2),
  easeOutSine: (t: number): number => Math.sin(t * Math.PI / 2),
  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,
  
  easeInElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  
  easeOutElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  
  easeInBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  
  easeInBounce: (t: number): number => 1 - Easing.easeOutBounce(1 - t),
  
  easeOutBounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  }
};

/**
 * Universal animation engine with accessibility support
 */
export class AnimationEngine {
  private animations = new Map<string, Animation>();
  private animationFrame: number | null = null;
  private respectMotionPreference = true;
  private globalTimeScale = 1.0;

  /**
   * Check if reduced motion is preferred by user
   */
  private get prefersReducedMotion(): boolean {
    return this.respectMotionPreference && 
           window.matchMedia && 
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Create and start an animation
   */
  animate(
    id: string,
    fromValues: AnimationTarget,
    toValues: AnimationTarget,
    config: AnimationConfig
  ): void {
    // Handle reduced motion preference
    if (this.prefersReducedMotion) {
      // For reduced motion, skip to end state immediately
      if (config.onStart) config.onStart();
      if (config.onUpdate) config.onUpdate(1, toValues);
      if (config.onComplete) config.onComplete();
      return;
    }

    const animation: Animation = {
      id,
      startTime: Date.now(),
      config: {
        duration: config.duration * this.globalTimeScale,
        delay: (config.delay || 0) * this.globalTimeScale,
        easing: config.easing || Easing.easeOutQuad,
        repeat: config.repeat || 1,
        yoyo: config.yoyo || false,
        onStart: config.onStart,
        onUpdate: config.onUpdate,
        onComplete: config.onComplete
      },
      fromValues: { ...fromValues },
      toValues: { ...toValues },
      currentValues: { ...fromValues },
      isActive: false,
      isCompleted: false,
      currentIteration: 0,
      direction: 'forward'
    };

    this.animations.set(id, animation);

    if (!this.animationFrame) {
      this.startAnimationLoop();
    }
  }

  /**
   * Stop an animation
   */
  stop(id: string, jumpToEnd = false): void {
    const animation = this.animations.get(id);
    if (!animation) return;

    if (jumpToEnd && animation.config.onUpdate) {
      animation.config.onUpdate(1, animation.toValues);
    }

    this.animations.delete(id);

    if (this.animations.size === 0) {
      this.stopAnimationLoop();
    }
  }

  /**
   * Stop all animations
   */
  stopAll(jumpToEnd = false): void {
    const animationIds = Array.from(this.animations.keys());
    for (const id of animationIds) {
      this.stop(id, jumpToEnd);
    }
  }

  /**
   * Check if an animation is running
   */
  isAnimating(id: string): boolean {
    const animation = this.animations.get(id);
    return animation ? animation.isActive && !animation.isCompleted : false;
  }

  /**
   * Get current animation values
   */
  getCurrentValues(id: string): AnimationTarget | null {
    const animation = this.animations.get(id);
    return animation ? { ...animation.currentValues } : null;
  }

  /**
   * Set global animation time scale (useful for slow-motion effects)
   */
  setTimeScale(scale: number): void {
    this.globalTimeScale = Math.max(0, scale);
  }

  /**
   * Enable/disable respect for motion preferences
   */
  setRespectMotionPreference(respect: boolean): void {
    this.respectMotionPreference = respect;
  }

  /**
   * Create a chain of animations that run in sequence
   */
  animateSequence(
    id: string,
    steps: Array<{
      fromValues: AnimationTarget;
      toValues: AnimationTarget;
      config: AnimationConfig;
    }>
  ): void {
    if (steps.length === 0) return;

    const runStep = (index: number) => {
      if (index >= steps.length) return;

      const step = steps[index];
      const stepId = `${id}_step_${index}`;

      this.animate(stepId, step.fromValues, step.toValues, {
        ...step.config,
        onComplete: () => {
          if (step.config.onComplete) step.config.onComplete();
          runStep(index + 1);
        }
      });
    };

    runStep(0);
  }

  /**
   * Create parallel animations that run simultaneously
   */
  animateParallel(
    id: string,
    animations: Array<{
      id: string;
      fromValues: AnimationTarget;
      toValues: AnimationTarget;
      config: AnimationConfig;
    }>
  ): void {
    let completed = 0;
    const total = animations.length;

    for (const anim of animations) {
      this.animate(`${id}_${anim.id}`, anim.fromValues, anim.toValues, {
        ...anim.config,
        onComplete: () => {
          if (anim.config.onComplete) anim.config.onComplete();
          completed++;
          // All parallel animations completed
          if (completed === total) {
            // Emit completion event or callback if needed
          }
        }
      });
    }
  }

  /**
   * Create common preset animations
   */
  fadeIn(id: string, duration = 250, delay = 0): void {
    this.animate(id, { opacity: 0 }, { opacity: 1 }, {
      duration,
      delay,
      easing: Easing.easeOutQuad
    });
  }

  fadeOut(id: string, duration = 250, delay = 0): void {
    this.animate(id, { opacity: 1 }, { opacity: 0 }, {
      duration,
      delay,
      easing: Easing.easeInQuad
    });
  }

  scaleIn(id: string, duration = 250, delay = 0): void {
    this.animate(id, { scale: 0.1 }, { scale: 1 }, {
      duration,
      delay,
      easing: Easing.easeOutBack
    });
  }

  scaleOut(id: string, duration = 200, delay = 0): void {
    this.animate(id, { scale: 1 }, { scale: 0 }, {
      duration,
      delay,
      easing: Easing.easeInBack
    });
  }

  pulse(id: string, duration = 400, repeat = 'infinite' as const): void {
    this.animate(id, { scale: 1 }, { scale: 1.2 }, {
      duration,
      repeat,
      yoyo: true,
      easing: Easing.easeInOutSine
    });
  }

  shake(id: string, intensity = 10, duration = 500): void {
    this.animate(id, { x: 0 }, { x: intensity }, {
      duration: duration / 8,
      repeat: 4,
      yoyo: true,
      easing: Easing.linear,
      onComplete: () => {
        this.animate(`${id}_return`, { x: intensity }, { x: 0 }, {
          duration: duration / 8,
          easing: Easing.easeOutQuad
        });
      }
    });
  }

  bounce(id: string, height = 20, duration = 800): void {
    this.animate(id, { y: 0 }, { y: -height }, {
      duration,
      yoyo: true,
      easing: Easing.easeOutBounce
    });
  }

  /**
   * Start the animation loop
   */
  private startAnimationLoop(): void {
    if (this.animationFrame) return;

    const update = () => {
      const now = Date.now();
      const completedAnimations: string[] = [];

      for (const [id, animation] of this.animations) {
        const elapsed = now - animation.startTime;
        
        // Check if animation should start (handle delay)
        if (!animation.isActive && elapsed >= animation.config.delay) {
          animation.isActive = true;
          if (animation.config.onStart) {
            animation.config.onStart();
          }
        }

        if (!animation.isActive) continue;

        const activeElapsed = elapsed - animation.config.delay;
        const iterationProgress = Math.min(activeElapsed / animation.config.duration, 1);
        
        // Apply easing
        const easedProgress = animation.config.easing(iterationProgress);
        
        // Calculate current values
        const currentDirection = animation.direction;
        const progress = currentDirection === 'forward' ? easedProgress : 1 - easedProgress;
        
        for (const key in animation.fromValues) {
          const fromValue = animation.fromValues[key];
          const toValue = animation.toValues[key];
          
          if (typeof fromValue === 'number' && typeof toValue === 'number') {
            animation.currentValues[key] = fromValue + (toValue - fromValue) * progress;
          } else {
            animation.currentValues[key] = progress >= 0.5 ? toValue : fromValue;
          }
        }

        // Call update callback
        if (animation.config.onUpdate) {
          animation.config.onUpdate(progress, animation.currentValues);
        }

        // Check if iteration completed
        if (iterationProgress >= 1) {
          animation.currentIteration++;
          
          // Handle yoyo
          if (animation.config.yoyo) {
            animation.direction = animation.direction === 'forward' ? 'reverse' : 'forward';
          }
          
          // Check if all repeats completed
          const maxIterations = animation.config.repeat === 'infinite' 
            ? Infinity 
            : (animation.config.repeat as number);
          
          if (animation.currentIteration >= maxIterations) {
            animation.isCompleted = true;
            completedAnimations.push(id);
            
            if (animation.config.onComplete) {
              animation.config.onComplete();
            }
          } else {
            // Reset for next iteration
            animation.startTime = now;
          }
        }
      }

      // Remove completed animations
      for (const id of completedAnimations) {
        this.animations.delete(id);
      }

      // Continue loop if there are active animations
      if (this.animations.size > 0) {
        this.animationFrame = requestAnimationFrame(update);
      } else {
        this.animationFrame = null;
      }
    };

    this.animationFrame = requestAnimationFrame(update);
  }

  /**
   * Stop the animation loop
   */
  private stopAnimationLoop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.stopAll();
    this.stopAnimationLoop();
  }
}