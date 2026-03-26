'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MotionDiv } from '@/components/koraline';
import type { HeroSection as HeroSectionConfig } from '@/lib/homepage-sections';

interface Props {
  config: HeroSectionConfig;
}

export default function HeroSection({ config }: Props) {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      {config.imageUrl && (
        <div className="absolute inset-0 z-0">
          <Image
            src={config.imageUrl}
            alt=""
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--k-bg-base)]/80 via-[var(--k-bg-base)]/60 to-[var(--k-bg-base)]" />
        </div>
      )}

      {/* Fallback gradient background when no image */}
      {!config.imageUrl && (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[var(--k-bg-base)] via-[var(--k-bg-surface)] to-[var(--k-bg-base)]">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full blur-[200px] opacity-20 bg-[var(--k-accent-indigo)]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[200px] opacity-15 bg-[var(--k-accent-cyan)]" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20 md:py-28">
        <MotionDiv animation="slideUp">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--k-text-primary)] mb-6 leading-tight">
            {config.title}
          </h2>
        </MotionDiv>

        <MotionDiv animation="slideUp" delay={0.15}>
          <p className="text-lg md:text-xl text-[var(--k-text-secondary)] mb-10 max-w-2xl mx-auto leading-relaxed">
            {config.subtitle}
          </p>
        </MotionDiv>

        <MotionDiv animation="slideUp" delay={0.3}>
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
