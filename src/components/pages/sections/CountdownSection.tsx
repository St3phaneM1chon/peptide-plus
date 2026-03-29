'use client';

import Link from 'next/link';
import type { CountdownSection as CountdownSectionType } from '@/lib/homepage-sections';
import { CountdownTimer } from './CountdownTimer';

export function CountdownRenderer({ section }: { section: CountdownSectionType }) {
  return (
    <div
      className="rounded-2xl p-10 text-center"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.10) 100%)',
        border: '1px solid rgba(99,102,241,0.20)',
      }}
    >
      {section.subtitle && (
        <p
          className="text-lg mb-8"
          style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.70))' }}
        >
          {section.subtitle}
        </p>
      )}

      <div className="mb-8">
        <CountdownTimer
          targetDate={section.targetDate}
          title={section.title}
        />
      </div>

      {section.ctaLabel && section.ctaHref && (
        <Link
          href={section.ctaHref}
          className="inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-lg transition-opacity hover:opacity-90"
          style={{ background: 'var(--k-accent, #6366f1)', color: '#fff' }}
        >
          {section.ctaLabel}
        </Link>
      )}
    </div>
  );
}
