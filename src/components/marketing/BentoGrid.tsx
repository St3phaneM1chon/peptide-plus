'use client';

import { useEffect, useRef, useState } from 'react';

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface BentoGridProps {
  title?: string;
  subtitle?: string;
  features: Feature[];
}

export function BentoGrid({
  title = 'Fonctionnalités',
  subtitle,
  features,
}: BentoGridProps) {
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
      { threshold: 0.15 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="bento" ref={ref}>
      <div className="bento__header">
        <h2 className="bento__title">{title}</h2>
        {subtitle && <p className="bento__subtitle">{subtitle}</p>}
      </div>

      <div className="bento__grid">
        {features.map((feature, i) => (
          <div
            key={i}
            className={`bento__card ${visible ? 'bento__card--visible' : ''}`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            <div className="bento__card-icon" aria-hidden="true">
              {feature.icon}
            </div>
            <h3 className="bento__card-title">{feature.title}</h3>
            <p className="bento__card-desc">{feature.description}</p>
          </div>
        ))}
      </div>

      <style jsx>{`
        .bento {
          padding: var(--k-space-16, 64px) var(--k-space-6, 24px);
          background: var(--k-bg-base, #0A0A0F);
          max-width: 1200px;
          margin: 0 auto;
        }

        .bento__header {
          text-align: center;
          margin-bottom: var(--k-space-12, 48px);
        }

        .bento__title {
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          margin: 0 0 var(--k-space-3, 12px);
        }

        .bento__subtitle {
          font-size: 17px;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .bento__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--k-space-5, 20px);
        }

        .bento__card {
          padding: var(--k-space-6, 24px);
          background: var(--k-glass-regular, rgba(255,255,255,0.08));
          backdrop-filter: blur(var(--k-blur-lg, 24px));
          -webkit-backdrop-filter: blur(var(--k-blur-lg, 24px));
          border: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          border-radius: var(--k-radius-xl, 20px);
          display: flex;
          flex-direction: column;
          gap: var(--k-space-3, 12px);
          opacity: 0;
          transform: translateY(24px) scale(0.97);
          transition:
            opacity 600ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 600ms cubic-bezier(0.16, 1, 0.3, 1),
            border-color var(--k-transition-fast, 150ms),
            box-shadow var(--k-transition-fast, 150ms);
        }

        .bento__card--visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .bento__card:hover {
          border-color: var(--k-border-default, rgba(255,255,255,0.10));
          box-shadow: var(--k-shadow-xl, 0 16px 48px rgba(0,0,0,0.6)),
                      var(--k-glow-primary);
          transform: translateY(-4px) scale(1.01);
        }

        .bento__card-icon {
          font-size: 32px;
          line-height: 1;
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--k-glass-thick, rgba(255,255,255,0.12));
          border-radius: var(--k-radius-lg, 14px);
        }

        .bento__card-title {
          font-size: 17px;
          font-weight: 600;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          margin: 0;
          letter-spacing: -0.01em;
        }

        .bento__card-desc {
          font-size: 14px;
          line-height: 1.6;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          margin: 0;
        }

        @media (max-width: 1024px) {
          .bento__grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .bento {
            padding: var(--k-space-12, 48px) var(--k-space-4, 16px);
          }

          .bento__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
