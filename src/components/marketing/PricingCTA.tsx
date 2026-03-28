'use client';

import Link from 'next/link';

interface PricingCTAProps {
  moduleName: string;
  addonPrice: number | null;
  includedIn: string[];
  gradient?: string;
}

function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(0)} $`;
}

export function PricingCTA({
  moduleName,
  addonPrice,
  includedIn,
  gradient,
}: PricingCTAProps) {
  return (
    <section
      className="pricing-cta"
      style={{ '--pc-gradient': gradient || 'var(--k-gradient-primary)' } as React.CSSProperties}
    >
      {/* Gradient accent line at top */}
      <div className="pricing-cta__accent" aria-hidden="true" />

      <div className="pricing-cta__inner">
        <div className="pricing-cta__text">
          <h2 className="pricing-cta__title">
            Prêt à activer {moduleName} ?
          </h2>

          {addonPrice !== null ? (
            <p className="pricing-cta__price">
              À partir de{' '}
              <span className="pricing-cta__amount">{formatPrice(addonPrice)}</span>
              <span className="pricing-cta__period"> / mois</span>
            </p>
          ) : includedIn.length > 0 ? (
            <p className="pricing-cta__included">
              Inclus dans {includedIn.join(', ')}
            </p>
          ) : (
            <p className="pricing-cta__included">
              Contactez-nous pour les tarifs
            </p>
          )}
        </div>

        <div className="pricing-cta__actions">
          <Link href="/pricing" className="pricing-cta__btn pricing-cta__btn--primary">
            Voir les plans
          </Link>
          <Link href="/demo" className="pricing-cta__btn pricing-cta__btn--secondary">
            Demander une démo
          </Link>
        </div>

        {/* Trust badges */}
        <div className="pricing-cta__trust">
          <div className="pricing-cta__trust-item">
            <span className="pricing-cta__trust-icon" aria-hidden="true">🔒</span>
            <span>Paiement sécurisé Stripe</span>
          </div>
          <div className="pricing-cta__trust-item">
            <span className="pricing-cta__trust-icon" aria-hidden="true">📅</span>
            <span>Essai 14 jours gratuit</span>
          </div>
          <div className="pricing-cta__trust-item">
            <span className="pricing-cta__trust-icon" aria-hidden="true">🚫</span>
            <span>Sans engagement</span>
          </div>
          <div className="pricing-cta__trust-item">
            <span className="pricing-cta__trust-icon" aria-hidden="true">🇨🇦</span>
            <span>Hébergé au Canada</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .pricing-cta {
          position: relative;
          padding: var(--k-space-16, 64px) var(--k-space-6, 24px);
          background: var(--k-bg-base, #0A0A0F);
        }

        .pricing-cta__accent {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--pc-gradient);
          opacity: 0.6;
        }

        .pricing-cta__inner {
          max-width: 720px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--k-space-8, 32px);
          text-align: center;
        }

        .pricing-cta__text {
          display: flex;
          flex-direction: column;
          gap: var(--k-space-3, 12px);
        }

        .pricing-cta__title {
          font-size: clamp(28px, 4vw, 40px);
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          margin: 0;
        }

        .pricing-cta__price {
          font-size: 17px;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          margin: 0;
        }

        .pricing-cta__amount {
          font-size: 36px;
          font-weight: 700;
          background: var(--pc-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .pricing-cta__period {
          font-size: 15px;
          color: var(--k-text-tertiary, rgba(255,255,255,0.4));
        }

        .pricing-cta__included {
          font-size: 17px;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          margin: 0;
        }

        .pricing-cta__actions {
          display: flex;
          gap: var(--k-space-4, 16px);
          flex-wrap: wrap;
          justify-content: center;
        }

        .pricing-cta__btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 36px;
          border-radius: var(--k-radius-pill, 9999px);
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          transition:
            transform var(--k-transition-fast, 150ms),
            box-shadow var(--k-transition-fast, 150ms);
        }

        .pricing-cta__btn:hover {
          transform: translateY(-2px);
        }

        .pricing-cta__btn--primary {
          background: var(--pc-gradient);
          color: #fff;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
        }

        .pricing-cta__btn--primary:hover {
          box-shadow: 0 8px 30px rgba(99, 102, 241, 0.45);
        }

        .pricing-cta__btn--secondary {
          background: var(--k-glass-regular, rgba(255,255,255,0.08));
          backdrop-filter: blur(var(--k-blur-md, 16px));
          -webkit-backdrop-filter: blur(var(--k-blur-md, 16px));
          border: 1px solid var(--k-border-default, rgba(255,255,255,0.10));
          color: var(--k-text-primary, rgba(255,255,255,0.95));
        }

        .pricing-cta__btn--secondary:hover {
          background: var(--k-glass-thick, rgba(255,255,255,0.12));
          border-color: var(--k-border-strong, rgba(255,255,255,0.15));
        }

        .pricing-cta__trust {
          display: flex;
          gap: var(--k-space-6, 24px);
          flex-wrap: wrap;
          justify-content: center;
          padding-top: var(--k-space-6, 24px);
          border-top: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          width: 100%;
        }

        .pricing-cta__trust-item {
          display: flex;
          align-items: center;
          gap: var(--k-space-2, 8px);
          font-size: 13px;
          color: var(--k-text-tertiary, rgba(255,255,255,0.4));
        }

        .pricing-cta__trust-icon {
          font-size: 16px;
        }

        @media (max-width: 640px) {
          .pricing-cta {
            padding: var(--k-space-12, 48px) var(--k-space-4, 16px);
          }

          .pricing-cta__actions {
            flex-direction: column;
            width: 100%;
          }

          .pricing-cta__btn {
            width: 100%;
          }

          .pricing-cta__trust {
            flex-direction: column;
            align-items: center;
            gap: var(--k-space-3, 12px);
          }
        }
      `}</style>
    </section>
  );
}
