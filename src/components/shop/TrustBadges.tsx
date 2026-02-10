'use client';

import { useTranslations } from '@/hooks/useTranslations';

interface TrustBadgesProps {
  variant?: 'horizontal' | 'vertical' | 'compact';
  showAll?: boolean;
}

export default function TrustBadges({ variant = 'horizontal', showAll = true }: TrustBadgesProps) {
  const { t } = useTranslations();

  const badges = [
    {
      icon: '🔬',
      title: t('trust.labTested') || 'Lab Tested',
      subtitle: t('trust.labTestedDesc') || 'Third-party verified',
    },
    {
      icon: '✅',
      title: t('trust.purity') || '99%+ Purity',
      subtitle: t('trust.purityDesc') || 'Guaranteed quality',
    },
    {
      icon: '🇨🇦',
      title: t('trust.madeInCanada') || 'Made in Canada',
      subtitle: t('trust.madeInCanadaDesc') || 'Toronto, ON',
    },
    {
      icon: '📄',
      title: t('trust.coaAvailable') || 'COA Available',
      subtitle: t('trust.coaAvailableDesc') || 'Every batch tested',
    },
    {
      icon: '🚚',
      title: t('trust.fastShipping') || 'Fast Shipping',
      subtitle: t('trust.fastShippingDesc') || '1-3 business days',
    },
    {
      icon: '🔒',
      title: t('trust.securePayment') || 'Secure Payment',
      subtitle: t('trust.securePaymentDesc') || 'SSL encrypted',
    },
  ];

  const displayBadges = showAll ? badges : badges.slice(0, 4);

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
              <p className="text-xs text-gray-500">{badge.subtitle}</p>
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
          <p className="text-xs text-gray-500">{badge.subtitle}</p>
        </div>
      ))}
    </div>
  );
}

// Hero variant for homepage
export function TrustBadgesHero() {
  return (
    <div className="bg-neutral-900 text-white py-4 border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-start gap-6 md:gap-10 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="text-orange-400">✓</span>
            <span>99%+ Purity Guaranteed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">✓</span>
            <span>Lab Tested & Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">✓</span>
            <span>Free Shipping Over $150</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-400">✓</span>
            <span>Online Support 24/7</span>
          </div>
        </div>
      </div>
    </div>
  );
}
