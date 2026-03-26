'use client';

import { MotionDiv } from '@/components/koraline';
import { GlassCard } from '@/components/koraline';
import type { FeaturesSection as FeaturesConfig } from '@/lib/homepage-sections';

interface Props {
  config: FeaturesConfig;
}

/**
 * Map icon name strings to SVG paths.
 * Supports a curated set of common icons tenants might configure.
 * Falls back to a generic sparkle icon for unknown names.
 */
function FeatureIcon({ name }: { name: string }) {
  const iconMap: Record<string, string> = {
    shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
    globe: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
    heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    truck: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    check: 'M5 13l4 4L19 7',
    users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    sparkle: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3',
  };

  const path = iconMap[name] || iconMap['sparkle'];

  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={path} />
    </svg>
  );
}

export default function FeaturesSection({ config }: Props) {
  if (!config.items || config.items.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-[var(--k-bg-base)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <MotionDiv animation="slideUp" className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--k-text-primary)] mb-3">
            {config.title}
          </h2>
          {config.subtitle && (
            <p className="text-[var(--k-text-secondary)] text-lg max-w-2xl mx-auto">
              {config.subtitle}
            </p>
          )}
        </MotionDiv>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {config.items.map((item, index) => (
            <MotionDiv key={index} animation="slideUp" delay={0.05 * index}>
              <GlassCard hoverable={false} className="h-full">
                <div className="p-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-[var(--k-accent-indigo)] bg-[var(--k-accent-indigo-10)]">
                    <FeatureIcon name={item.icon} />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--k-text-primary)] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--k-text-secondary)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </GlassCard>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}
