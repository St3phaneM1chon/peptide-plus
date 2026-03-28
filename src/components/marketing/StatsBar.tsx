'use client';

import { useEffect, useRef, useState } from 'react';

interface Stat {
  value: string;
  label: string;
}

interface StatsBarProps {
  stats: Stat[];
  gradient?: string;
}

export function StatsBar({ stats, gradient }: StatsBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className="stats-bar"
      ref={ref}
      style={{ '--stats-gradient': gradient || 'var(--k-gradient-primary)' } as React.CSSProperties}
    >
      <div className="stats-bar__inner">
        {stats.map((stat, i) => (
          <div
            key={i}
            className={`stats-bar__item ${visible ? 'stats-bar__item--visible' : ''}`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <span className="stats-bar__value">{stat.value}</span>
            <span className="stats-bar__label">{stat.label}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .stats-bar {
          padding: var(--k-space-12, 48px) var(--k-space-6, 24px);
          background: var(--k-bg-surface, #111116);
          border-top: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          border-bottom: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
        }

        .stats-bar__inner {
          max-width: 1000px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--k-space-6, 24px);
        }

        .stats-bar__item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--k-space-2, 8px);
          padding: var(--k-space-5, 20px) var(--k-space-4, 16px);
          border-radius: var(--k-radius-xl, 20px);
          background: var(--k-glass-ultra-thin, rgba(255,255,255,0.03));
          border: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          opacity: 0;
          transform: translateY(20px);
          transition:
            opacity 600ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .stats-bar__item--visible {
          opacity: 1;
          transform: translateY(0);
        }

        .stats-bar__value {
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
          background: var(--stats-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .stats-bar__label {
          font-size: 13px;
          font-weight: 500;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          text-align: center;
          letter-spacing: 0.01em;
        }

        @media (max-width: 768px) {
          .stats-bar__inner {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 480px) {
          .stats-bar {
            padding: var(--k-space-8, 32px) var(--k-space-4, 16px);
          }
        }
      `}</style>
    </section>
  );
}
