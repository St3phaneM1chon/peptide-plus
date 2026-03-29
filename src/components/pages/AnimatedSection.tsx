'use client';

/**
 * AnimatedSection — Wraps any page section with scroll-triggered animation.
 * Uses Framer Motion's whileInView for performance.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { animationVariants, type AnimationType } from '@/lib/puck/animations';

interface AnimatedSectionProps {
  animation?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}

export default function AnimatedSection({
  animation = 'none',
  children,
  className = '',
  style,
  delay = 0,
}: AnimatedSectionProps) {
  const animType = (animation || 'none') as AnimationType;

  if (animType === 'none') {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  const variants = animationVariants[animType] || animationVariants.none;

  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={variants}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
