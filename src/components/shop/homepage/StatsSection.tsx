'use client';

import { MotionDiv } from '@/components/koraline';
import type { StatsSection as StatsConfig } from '@/lib/homepage-sections';

interface Props {
  config: StatsConfig;
}

export default function StatsSection({ config }: Props) {
  if (!config.items || config.items.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-[var(--k-bg-surface)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {config.items.map((stat, index) => (
            <MotionDiv key={index} animation="scaleIn" delay={0.1 * index}>
              <div className="text-center">
                <p
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ backgroundImage: 'var(--k-gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  {stat.value}
                </p>
                <p className="text-sm md:text-base text-[var(--k-text-secondary)] font-medium">
                  {stat.label}
                </p>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}
