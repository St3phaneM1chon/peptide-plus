'use client';

import Link from 'next/link';

interface FeatureHeroProps {
  icon: string;
  name: string;
  tagline: string;
  description: string;
  gradient: string;
  includedIn: string[];
  ctaPrimary?: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
}

export function FeatureHero({
  icon,
  name,
  tagline,
  description,
  gradient,
  includedIn,
  ctaPrimary = { label: 'Commencer maintenant', href: '/pricing' },
  ctaSecondary = { label: 'Voir la démo', href: '/demo' },
}: FeatureHeroProps) {
  return (
    <section className="feature-hero" style={{ '--hero-gradient': gradient } as React.CSSProperties}>
      {/* Gradient mesh background */}
      <div className="feature-hero__mesh" aria-hidden="true">
        <div className="feature-hero__orb feature-hero__orb--1" />
        <div className="feature-hero__orb feature-hero__orb--2" />
        <div className="feature-hero__orb feature-hero__orb--3" />
      </div>

      <div className="feature-hero__content">
        {/* Plan badge */}
        {includedIn.length > 0 && (
          <div className="feature-hero__badge">
            <span className="feature-hero__badge-dot" />
            Inclus dans {includedIn[0]}
            {includedIn.length > 1 && ` + ${includedIn.length - 1} autres`}
          </div>
        )}

        {/* Icon */}
        <div className="feature-hero__icon" aria-hidden="true">
          {icon}
        </div>

        {/* Title */}
        <h1 className="feature-hero__title">{name}</h1>

        {/* Tagline */}
        <p className="feature-hero__tagline">{tagline}</p>

        {/* Description */}
        <p className="feature-hero__description">{description}</p>

        {/* CTAs */}
        <div className="feature-hero__ctas">
          <Link href={ctaPrimary.href} className="feature-hero__cta feature-hero__cta--primary">
            {ctaPrimary.label}
          </Link>
          <Link href={ctaSecondary.href} className="feature-hero__cta feature-hero__cta--secondary">
            {ctaSecondary.label}
          </Link>
        </div>
      </div>

      <style jsx>{`
        .feature-hero {
          position: relative;
          min-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 120px var(--k-space-6, 24px) 80px;
          overflow: hidden;
          background: var(--k-bg-base, #0A0A0F);
        }

        .feature-hero__mesh {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .feature-hero__orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.4;
        }

        .feature-hero__orb--1 {
          width: 600px;
          height: 600px;
          top: -200px;
          left: -100px;
          background: var(--hero-gradient);
          animation: orbFloat1 12s ease-in-out infinite;
        }

        .feature-hero__orb--2 {
          width: 400px;
          height: 400px;
          bottom: -100px;
          right: -50px;
          background: var(--hero-gradient);
          opacity: 0.25;
          animation: orbFloat2 15s ease-in-out infinite;
        }

        .feature-hero__orb--3 {
          width: 300px;
          height: 300px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--hero-gradient);
          opacity: 0.15;
          animation: orbFloat3 10s ease-in-out infinite;
        }

        @keyframes orbFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 30px) scale(1.1); }
        }

        @keyframes orbFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, -20px) scale(1.05); }
        }

        @keyframes orbFloat3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.2); }
        }

        .feature-hero__content {
          position: relative;
          z-index: 1;
          max-width: 720px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--k-space-5, 20px);
        }

        .feature-hero__badge {
          display: inline-flex;
          align-items: center;
          gap: var(--k-space-2, 8px);
          padding: var(--k-space-2, 8px) var(--k-space-4, 16px);
          background: var(--k-glass-regular, rgba(255,255,255,0.08));
          backdrop-filter: blur(var(--k-blur-md, 16px));
          -webkit-backdrop-filter: blur(var(--k-blur-md, 16px));
          border: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          border-radius: var(--k-radius-pill, 9999px);
          font-size: 13px;
          font-weight: 500;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          letter-spacing: 0.02em;
        }

        .feature-hero__badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--k-accent-emerald, #10b981);
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }

        .feature-hero__icon {
          font-size: 64px;
          line-height: 1;
          margin-bottom: var(--k-space-2, 8px);
        }

        .feature-hero__title {
          font-size: clamp(40px, 6vw, 72px);
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          background: var(--hero-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .feature-hero__tagline {
          font-size: clamp(20px, 2.5vw, 28px);
          font-weight: 500;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          line-height: 1.3;
          letter-spacing: -0.01em;
        }

        .feature-hero__description {
          font-size: 17px;
          line-height: 1.7;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          max-width: 600px;
        }

        .feature-hero__ctas {
          display: flex;
          gap: var(--k-space-4, 16px);
          margin-top: var(--k-space-4, 16px);
          flex-wrap: wrap;
          justify-content: center;
        }

        .feature-hero__cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 32px;
          border-radius: var(--k-radius-pill, 9999px);
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          transition:
            transform var(--k-transition-fast, 150ms),
            box-shadow var(--k-transition-fast, 150ms),
            opacity var(--k-transition-fast, 150ms);
        }

        .feature-hero__cta:hover {
          transform: translateY(-2px);
        }

        .feature-hero__cta--primary {
          background: var(--hero-gradient);
          color: #fff;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
        }

        .feature-hero__cta--primary:hover {
          box-shadow: 0 8px 30px rgba(99, 102, 241, 0.45);
        }

        .feature-hero__cta--secondary {
          background: var(--k-glass-regular, rgba(255,255,255,0.08));
          backdrop-filter: blur(var(--k-blur-md, 16px));
          -webkit-backdrop-filter: blur(var(--k-blur-md, 16px));
          border: 1px solid var(--k-border-default, rgba(255,255,255,0.10));
          color: var(--k-text-primary, rgba(255,255,255,0.95));
        }

        .feature-hero__cta--secondary:hover {
          background: var(--k-glass-thick, rgba(255,255,255,0.12));
          border-color: var(--k-border-strong, rgba(255,255,255,0.15));
        }

        @media (max-width: 640px) {
          .feature-hero {
            min-height: 70vh;
            padding: 100px var(--k-space-4, 16px) 60px;
          }

          .feature-hero__icon {
            font-size: 48px;
          }

          .feature-hero__ctas {
            flex-direction: column;
            width: 100%;
          }

          .feature-hero__cta {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
