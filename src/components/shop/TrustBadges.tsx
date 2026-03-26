'use client';

import { useI18n } from '@/i18n/client';
import { useTenantBranding } from '@/components/shop/TenantBrandingProvider';

interface TrustBadgesProps {
  variant?: 'horizontal' | 'vertical' | 'compact';
  showAll?: boolean;
}

export default function TrustBadges({ variant = 'horizontal', showAll = true }: TrustBadgesProps) {
  const { t } = useI18n();
  const tenant = useTenantBranding();

  // Use trust badges from tenant branding (DB-driven).
  // If tenant has no trustBadges configured, show generic secure-payment / fast-shipping from i18n.
  const dynamicBadges = tenant.trustBadges.length > 0
    ? tenant.trustBadges.map((b) => ({
        icon: b.icon,
        title: b.label,
        subtitle: '',
      }))
    : [
        {
          icon: '🚚',
          title: t('trust.fastShipping') || 'Fast Shipping',
          subtitle: t('trust.fastShippingDesc') || '',
        },
        {
          icon: '🔒',
          title: t('trust.securePayment') || 'Secure Payment',
          subtitle: t('trust.securePaymentDesc') || '',
        },
      ];

  const displayBadges = showAll ? dynamicBadges : dynamicBadges.slice(0, 4);

  if (displayBadges.length === 0) return null;

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4">
        {displayBadges.map((badge, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span>{badge.icon}</span>
            <span className="font-medium text-gray-700">{badge.title}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div className="space-y-3">
        {displayBadges.map((badge, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <span className="text-2xl">{badge.icon}</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{badge.title}</p>
              {badge.subtitle && <p className="text-xs text-gray-500">{badge.subtitle}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default: horizontal
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {displayBadges.map((badge, index) => (
        <div key={index} className="text-center p-4 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
          <span className="text-3xl mb-2 block">{badge.icon}</span>
          <p className="font-semibold text-gray-900 text-sm">{badge.title}</p>
          {badge.subtitle && <p className="text-xs text-gray-500">{badge.subtitle}</p>}
        </div>
      ))}
    </div>
  );
}

// Hero variant for homepage — uses i18n keys (generic, not company-specific)
export function TrustBadgesHero() {
  const { t } = useI18n();
  const tenant = useTenantBranding();

  // If tenant has configured trust badges, show those; otherwise show generic i18n badges
  const heroBadges = tenant.trustBadges.length > 0
    ? tenant.trustBadges.slice(0, 4)
    : null;

  return (
    <div className="bg-blue-50 text-neutral-800 py-4 border-t border-blue-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 text-sm font-medium">
          {heroBadges ? (
            heroBadges.map((badge, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-primary-400">{badge.icon || '✓'}</span>
                <span>{badge.label}</span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-primary-400">✓</span>
                <span>{t('trust.fastShipping')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary-400">✓</span>
                <span>{t('trust.securePayment')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary-400">✓</span>
                <span>{t('trust.support')}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
