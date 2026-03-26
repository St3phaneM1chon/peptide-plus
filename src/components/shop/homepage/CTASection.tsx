'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MotionDiv } from '@/components/koraline';

import type { CTASection as CTAConfig } from '@/lib/homepage-sections';

interface Props {
  config: CTAConfig;
}

export default function CTASection({ config }: Props) {
  return (
    <section className="relative py-20 md:py-28 overflow-hidden">
      {/* Background */}
      {config.imageUrl ? (
        <div className="absolute inset-0 z-0">
          <Image
            src={config.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[var(--k-bg-base)]/80" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0" style={{ background: 'var(--k-gradient-surface)' }}>
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full blur-[200px] opacity-20 bg-[var(--k-accent-indigo)]" />
          <div className="absolute bottom-1/3 left-1/4 w-[300px] h-[300px] rounded-full blur-[200px] opacity-15 bg-[var(--k-accent-cyan)]" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <MotionDiv animation="slideUp">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[var(--k-text-primary)] mb-4">
            {config.title}
          </h2>
        </MotionDiv>

        {config.subtitle && (
          <MotionDiv animation="slideUp" delay={0.1}>
            <p className="text-lg text-[var(--k-text-secondary)] mb-8 max-w-xl mx-auto">
              {config.subtitle}
            </p>
          </MotionDiv>
        )}

        <MotionDiv animation="slideUp" delay={0.2}>
          <Link
            href={config.ctaHref}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white text-lg transition-all duration-300 hover:scale-105"
            style={{
              background: 'var(--k-gradient-primary)',
              boxShadow: 'var(--k-glow-primary)',
            }}
          >
            {config.ctaLabel}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </MotionDiv>
      </div>
    </section>
  );
}
