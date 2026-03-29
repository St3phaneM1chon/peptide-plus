/**
 * Animation presets for Puck page builder components.
 * Uses Framer Motion variants for scroll-triggered animations.
 */

import type { Variants } from 'framer-motion';

export type AnimationType =
  | 'none'
  | 'fadeIn'
  | 'slideUp'
  | 'slideLeft'
  | 'slideRight'
  | 'scale'
  | 'bounce'
  | 'parallax'
  | 'rotateIn'
  | 'blur';

export const animationVariants: Record<AnimationType, Variants> = {
  none: {
    hidden: {},
    visible: {},
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } },
  },
  slideUp: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  },
  slideLeft: {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  },
  slideRight: {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.85 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
  },
  bounce: {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 15,
      },
    },
  },
  parallax: {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] } },
  },
  rotateIn: {
    hidden: { opacity: 0, rotate: -5, scale: 0.95 },
    visible: { opacity: 1, rotate: 0, scale: 1, transition: { duration: 0.6, ease: 'easeOut' } },
  },
  blur: {
    hidden: { opacity: 0, filter: 'blur(10px)' },
    visible: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.7, ease: 'easeOut' } },
  },
};

/**
 * Stagger children animation for grids and lists
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};
