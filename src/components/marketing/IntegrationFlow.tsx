'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MODULE_DATA } from '@/lib/marketing/module-data';

interface IntegrationFlowProps {
  /** Slug of the current (center) module */
  currentSlug: string;
  /** Slugs of connected modules */
  integrations: string[];
}

export function IntegrationFlow({ currentSlug, integrations }: IntegrationFlowProps) {
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

  const current = MODULE_DATA[currentSlug];
  if (!current) return null;

  const connectedModules = integrations
    .map((slug) => MODULE_DATA[slug])
    .filter(Boolean);

  return (
    <section className="integration-flow" ref={ref}>
      <div className="integration-flow__header">
        <h2 className="integration-flow__title">Intégrations natives</h2>
        <p className="integration-flow__subtitle">
          {current.name} se connecte nativement aux autres modules Koraline.
          Vos données circulent sans configuration.
        </p>
      </div>

      <div className={`integration-flow__diagram ${visible ? 'integration-flow__diagram--visible' : ''}`}>
        {/* Connection lines — SVG */}
        <svg
          className="integration-flow__lines"
          viewBox="0 0 600 400"
          fill="none"
          aria-hidden="true"
        >
          {connectedModules.map((_, i) => {
            const total = connectedModules.length;
            const angle = (Math.PI / (total + 1)) * (i + 1) - Math.PI / 2;
            const radiusX = 240;
            const radiusY = 160;
            const cx = 300;
            const cy = 200;
            const x = cx + radiusX * Math.cos(angle);
            const y = cy + radiusY * Math.sin(angle);
            const midX = (cx + x) / 2;
            const midY = cy + (y - cy) * 0.3;

            return (
              <path
                key={i}
                d={`M ${cx} ${cy} Q ${midX} ${midY} ${x} ${y}`}
                stroke="url(#flowGradient)"
                strokeWidth="2"
                strokeDasharray="6 4"
                opacity="0.4"
                className={`integration-flow__line ${visible ? 'integration-flow__line--visible' : ''}`}
                style={{ animationDelay: `${i * 150}ms` }}
              />
            );
          })}
          <defs>
            <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--k-accent-indigo, #6366f1)" />
              <stop offset="100%" stopColor="var(--k-accent-cyan, #06b6d4)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center node */}
        <div className="integration-flow__center">
          <span className="integration-flow__center-icon">{current.icon}</span>
          <span className="integration-flow__center-name">{current.name}</span>
        </div>

        {/* Connected nodes */}
        {connectedModules.map((mod, i) => {
          const total = connectedModules.length;
          const angle = (360 / (total + 1)) * (i + 1) - 90;
          const radiusPercent = 38;
          const x = 50 + radiusPercent * Math.cos((angle * Math.PI) / 180);
          const y = 50 + radiusPercent * Math.sin((angle * Math.PI) / 180);

          return (
            <Link
              key={mod.slug}
              href={`/platform/features/${mod.slug}`}
              className={`integration-flow__node ${visible ? 'integration-flow__node--visible' : ''}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transitionDelay: `${(i + 1) * 120}ms`,
              }}
            >
              <span className="integration-flow__node-icon">{mod.icon}</span>
              <span className="integration-flow__node-name">{mod.name}</span>
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .integration-flow {
          padding: var(--k-space-16, 64px) var(--k-space-6, 24px);
          background: var(--k-bg-base, #0A0A0F);
        }

        .integration-flow__header {
          text-align: center;
          margin-bottom: var(--k-space-12, 48px);
        }

        .integration-flow__title {
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          margin: 0 0 var(--k-space-3, 12px);
        }

        .integration-flow__subtitle {
          font-size: 17px;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          max-width: 560px;
          margin: 0 auto;
          line-height: 1.6;
        }

        .integration-flow__diagram {
          position: relative;
          max-width: 640px;
          margin: 0 auto;
          aspect-ratio: 3 / 2;
        }

        .integration-flow__lines {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .integration-flow__line {
          stroke-dashoffset: 200;
          transition: stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .integration-flow__line--visible {
          stroke-dashoffset: 0;
        }

        .integration-flow__center {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--k-space-2, 8px);
          padding: var(--k-space-5, 20px) var(--k-space-6, 24px);
          background: var(--k-glass-thick, rgba(255,255,255,0.12));
          backdrop-filter: blur(var(--k-blur-xl, 40px));
          -webkit-backdrop-filter: blur(var(--k-blur-xl, 40px));
          border: 1px solid var(--k-border-strong, rgba(255,255,255,0.15));
          border-radius: var(--k-radius-xl, 20px);
          box-shadow: var(--k-glow-primary);
          z-index: 2;
        }

        .integration-flow__center-icon {
          font-size: 32px;
          line-height: 1;
        }

        .integration-flow__center-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
        }

        .integration-flow__node {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--k-space-1, 4px);
          padding: var(--k-space-3, 12px) var(--k-space-4, 16px);
          background: var(--k-glass-regular, rgba(255,255,255,0.08));
          backdrop-filter: blur(var(--k-blur-md, 16px));
          -webkit-backdrop-filter: blur(var(--k-blur-md, 16px));
          border: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          border-radius: var(--k-radius-lg, 14px);
          text-decoration: none;
          z-index: 2;
          opacity: 0;
          transition:
            opacity 600ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 600ms cubic-bezier(0.16, 1, 0.3, 1),
            border-color var(--k-transition-fast, 150ms),
            box-shadow var(--k-transition-fast, 150ms);
        }

        .integration-flow__node--visible {
          opacity: 1;
        }

        .integration-flow__node:hover {
          border-color: var(--k-border-default, rgba(255,255,255,0.10));
          box-shadow: var(--k-glow-accent);
          transform: translate(-50%, -50%) scale(1.08);
        }

        .integration-flow__node-icon {
          font-size: 24px;
          line-height: 1;
        }

        .integration-flow__node-name {
          font-size: 12px;
          font-weight: 500;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .integration-flow__diagram {
            aspect-ratio: 1 / 1;
          }

          .integration-flow__node {
            padding: var(--k-space-2, 8px) var(--k-space-3, 12px);
          }

          .integration-flow__node-name {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
