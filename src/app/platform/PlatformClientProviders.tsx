'use client';

import CookieConsent from '@/components/shop/CookieConsent';

/**
 * Client-side providers and overlays for the Platform (Koraline SaaS) layout.
 *
 * Loi 25 (Quebec) requires explicit cookie consent on ALL public-facing pages,
 * including the SaaS marketing/landing pages under /platform/*.
 * The CookieConsent component handles:
 *  - Bottom banner on first visit (localStorage-backed)
 *  - "Accept" / "Decline" buttons
 *  - Persists proof to backend API for RGPD/Loi 25 compliance
 *  - Dispatches `cookie_consent_change` event for GoogleAnalytics & MetaPixel
 */
export default function PlatformClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <CookieConsent />
    </>
  );
}
