'use client';

import { useEffect, useRef, useState } from 'react';

interface Annotation {
  label: string;
  x: string; // CSS percentage
  y: string; // CSS percentage
}

interface ScreenshotSectionProps {
  title: string;
  description: string;
  screenshotUrl?: string;
  screenshotAlt?: string;
  annotations?: Annotation[];
  gradient?: string;
  reversed?: boolean;
}

export function ScreenshotSection({
  title,
  description,
  screenshotUrl,
  screenshotAlt = 'Interface screenshot',
  annotations = [],
  gradient,
  reversed = false,
}: ScreenshotSectionProps) {
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
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      className={`screenshot ${reversed ? 'screenshot--reversed' : ''}`}
      ref={ref}
      style={{ '--ss-gradient': gradient || 'var(--k-gradient-primary)' } as React.CSSProperties}
    >
      <div className={`screenshot__inner ${visible ? 'screenshot__inner--visible' : ''}`}>
        {/* Text column */}
        <div className="screenshot__text">
          <h2 className="screenshot__title">{title}</h2>
          <p className="screenshot__desc">{description}</p>
        </div>

        {/* Screenshot mockup */}
        <div className="screenshot__mockup">
          <div className="screenshot__frame">
            {/* Browser chrome */}
            <div className="screenshot__chrome">
              <span className="screenshot__dot" />
              <span className="screenshot__dot" />
              <span className="screenshot__dot" />
            </div>

            {/* Image or placeholder */}
            <div className="screenshot__viewport">
              {screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={screenshotUrl}
                  alt={screenshotAlt}
                  className="screenshot__img"
                  loading="lazy"
                />
              ) : (
                <div className="screenshot__placeholder">
                  <span className="screenshot__placeholder-icon">🖥️</span>
                  <span className="screenshot__placeholder-text">Apercu de l&apos;interface</span>
                </div>
              )}

              {/* Annotations */}
              {annotations.map((ann, i) => (
                <div
                  key={i}
                  className="screenshot__annotation"
                  style={{ left: ann.x, top: ann.y }}
                >
                  <span className="screenshot__annotation-pulse" />
                  <span className="screenshot__annotation-label">{ann.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .screenshot {
          padding: var(--k-space-16, 64px) var(--k-space-6, 24px);
          background: var(--k-bg-surface, #111116);
          overflow: hidden;
        }

        .screenshot__inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: var(--k-space-12, 48px);
          align-items: center;
          opacity: 0;
          transform: translateY(32px);
          transition:
            opacity 800ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 800ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .screenshot--reversed .screenshot__inner {
          direction: rtl;
        }

        .screenshot--reversed .screenshot__text,
        .screenshot--reversed .screenshot__mockup {
          direction: ltr;
        }

        .screenshot__inner--visible {
          opacity: 1;
          transform: translateY(0);
        }

        .screenshot__text {
          display: flex;
          flex-direction: column;
          gap: var(--k-space-4, 16px);
        }

        .screenshot__title {
          font-size: clamp(24px, 3vw, 36px);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          margin: 0;
          line-height: 1.2;
        }

        .screenshot__desc {
          font-size: 16px;
          line-height: 1.7;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          margin: 0;
        }

        .screenshot__mockup {
          perspective: 1200px;
        }

        .screenshot__frame {
          background: var(--k-bg-raised, #1A1A22);
          border: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          border-radius: var(--k-radius-xl, 20px);
          overflow: hidden;
          box-shadow: var(--k-shadow-xl, 0 16px 48px rgba(0,0,0,0.6));
          transition: transform var(--k-transition-slow, 400ms);
        }

        .screenshot__frame:hover {
          transform: rotateY(-2deg) rotateX(1deg) scale(1.02);
        }

        .screenshot__chrome {
          display: flex;
          gap: 6px;
          padding: 12px 16px;
          background: var(--k-bg-overlay, #222230);
          border-bottom: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
        }

        .screenshot__dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--k-glass-thick, rgba(255,255,255,0.12));
        }

        .screenshot__viewport {
          position: relative;
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .screenshot__img {
          width: 100%;
          height: auto;
          display: block;
        }

        .screenshot__placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--k-space-3, 12px);
          padding: var(--k-space-12, 48px);
          color: var(--k-text-tertiary, rgba(255,255,255,0.4));
        }

        .screenshot__placeholder-icon {
          font-size: 48px;
        }

        .screenshot__placeholder-text {
          font-size: 14px;
        }

        .screenshot__annotation {
          position: absolute;
          display: flex;
          align-items: center;
          gap: var(--k-space-2, 8px);
        }

        .screenshot__annotation-pulse {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--k-accent-indigo, #6366f1);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3);
          animation: annotatePulse 2s ease-in-out infinite;
        }

        @keyframes annotatePulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.1); }
        }

        .screenshot__annotation-label {
          padding: 4px 10px;
          background: var(--k-glass-thick, rgba(255,255,255,0.12));
          backdrop-filter: blur(var(--k-blur-sm, 8px));
          -webkit-backdrop-filter: blur(var(--k-blur-sm, 8px));
          border-radius: var(--k-radius-sm, 6px);
          font-size: 12px;
          font-weight: 500;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .screenshot__inner {
            grid-template-columns: 1fr;
            gap: var(--k-space-8, 32px);
          }

          .screenshot--reversed .screenshot__inner {
            direction: ltr;
          }

          .screenshot__frame:hover {
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}
