'use client';

import Image from 'next/image';
import { useI18n } from '@/i18n/client';
import type { TenantBranding } from '@/lib/tenant-branding';

interface HomePageEmptyProps {
  branding: TenantBranding;
}

/**
 * Clean branded welcome page for tenants with no products and no courses.
 * Shown when the tenant is setting up their store — looks professional even when empty.
 * Dark glass styling, centered, no hardcoded company references.
 */
export default function HomePageEmpty({ branding }: HomePageEmptyProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 relative overflow-hidden">
      {/* Subtle animated background effect */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--tenant-primary,#0066CC)] rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[var(--tenant-secondary,#003366)] rounded-full blur-[128px] animate-pulse delay-1000" />
      </div>

      {/* Glass card */}
      <div className="relative z-10 max-w-lg w-full mx-4 p-10 md:p-14 rounded-3xl text-center"
        style={{
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* Tenant Logo */}
        <div className="mb-8">
          {branding.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt={branding.name}
              width={240}
              height={80}
              className="h-16 md:h-20 w-auto mx-auto brightness-0 invert"
              priority
            />
          ) : (
            <div
              className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {branding.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Welcome text */}
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          {t('home.welcomeTo') || 'Bienvenue chez'} {branding.name}
        </h2>

        <p className="text-white/60 text-base md:text-lg leading-relaxed mb-8">
          {t('home.storeComingSoon') || 'Notre boutique est en cours de preparation. Revenez bientot !'}
        </p>

        {/* Decorative divider */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-px w-12 bg-white/20" />
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: branding.primaryColor }} />
          <div className="h-px w-12 bg-white/20" />
        </div>

        {/* Powered by badge */}
        <p className="text-white/30 text-xs">
          {t('home.poweredBy') || 'Propulse par'} Koraline
        </p>
      </div>
    </div>
  );
}
