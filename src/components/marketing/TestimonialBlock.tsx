'use client';

interface TestimonialMetric {
  value: string;
  label: string;
}

interface TestimonialBlockProps {
  quote: string;
  authorName: string;
  authorRole: string;
  authorCompany: string;
  avatarUrl?: string;
  metrics?: TestimonialMetric[];
  gradient?: string;
}

export function TestimonialBlock({
  quote,
  authorName,
  authorRole,
  authorCompany,
  avatarUrl,
  metrics = [],
  gradient,
}: TestimonialBlockProps) {
  return (
    <section
      className="testimonial"
      style={{ '--t-gradient': gradient || 'var(--k-gradient-primary)' } as React.CSSProperties}
    >
      <div className="testimonial__inner">
        {/* Quote */}
        <div className="testimonial__quote-block">
          <span className="testimonial__quote-mark" aria-hidden="true">&ldquo;</span>
          <blockquote className="testimonial__quote">{quote}</blockquote>
        </div>

        {/* Author */}
        <div className="testimonial__author">
          <div className="testimonial__avatar">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={authorName} className="testimonial__avatar-img" loading="lazy" />
            ) : (
              <span className="testimonial__avatar-fallback">
                {authorName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="testimonial__info">
            <span className="testimonial__name">{authorName}</span>
            <span className="testimonial__role">
              {authorRole}, {authorCompany}
            </span>
          </div>
        </div>

        {/* Metrics */}
        {metrics.length > 0 && (
          <div className="testimonial__metrics">
            {metrics.map((m, i) => (
              <div key={i} className="testimonial__metric">
                <span className="testimonial__metric-value">{m.value}</span>
                <span className="testimonial__metric-label">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .testimonial {
          padding: var(--k-space-16, 64px) var(--k-space-6, 24px);
          background: var(--k-bg-surface, #111116);
        }

        .testimonial__inner {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--k-space-8, 32px);
          padding: var(--k-space-10, 40px);
          background: var(--k-glass-regular, rgba(255,255,255,0.08));
          backdrop-filter: blur(var(--k-blur-lg, 24px));
          -webkit-backdrop-filter: blur(var(--k-blur-lg, 24px));
          border: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          border-radius: var(--k-radius-2xl, 24px);
        }

        .testimonial__quote-block {
          position: relative;
          text-align: center;
        }

        .testimonial__quote-mark {
          position: absolute;
          top: -32px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 72px;
          line-height: 1;
          background: var(--t-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          opacity: 0.3;
          pointer-events: none;
        }

        .testimonial__quote {
          font-size: clamp(18px, 2.5vw, 22px);
          line-height: 1.6;
          font-weight: 400;
          font-style: italic;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          margin: 0;
          padding-top: var(--k-space-4, 16px);
        }

        .testimonial__author {
          display: flex;
          align-items: center;
          gap: var(--k-space-4, 16px);
        }

        .testimonial__avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid var(--k-border-default, rgba(255,255,255,0.10));
          flex-shrink: 0;
        }

        .testimonial__avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .testimonial__avatar-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--t-gradient);
          color: #fff;
          font-size: 20px;
          font-weight: 700;
        }

        .testimonial__info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .testimonial__name {
          font-size: 15px;
          font-weight: 600;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
        }

        .testimonial__role {
          font-size: 13px;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
        }

        .testimonial__metrics {
          display: flex;
          gap: var(--k-space-8, 32px);
          padding-top: var(--k-space-4, 16px);
          border-top: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          width: 100%;
          justify-content: center;
        }

        .testimonial__metric {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .testimonial__metric-value {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.02em;
          background: var(--t-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .testimonial__metric-label {
          font-size: 12px;
          color: var(--k-text-tertiary, rgba(255,255,255,0.4));
          text-align: center;
        }

        @media (max-width: 640px) {
          .testimonial__inner {
            padding: var(--k-space-6, 24px);
          }

          .testimonial__metrics {
            flex-wrap: wrap;
            gap: var(--k-space-5, 20px);
          }
        }
      `}</style>
    </section>
  );
}
