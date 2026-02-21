'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * GDPR-compliant Google Analytics 4 loader.
 *
 * GA4 scripts are ONLY injected when the user has explicitly accepted cookies
 * via the CookieConsent banner (localStorage key `cookie_consent` === 'accepted').
 *
 * - If consent has not been given yet: GA4 does NOT load.
 * - If consent is declined: GA4 does NOT load.
 * - If consent is accepted after page load: GA4 loads immediately via the
 *   `cookie_consent_change` custom event dispatched by CookieConsent.
 */
export function GoogleAnalytics() {
  const [hasAnalyticsConsent, setHasAnalyticsConsent] = useState(false);

  useEffect(() => {
    // Check initial consent state from localStorage
    const consent = localStorage.getItem('cookie_consent');
    setHasAnalyticsConsent(consent === 'accepted');

    // Listen for real-time consent changes from the CookieConsent banner
    const handleConsentChange = (e: Event) => {
      const detail = (e as CustomEvent<{ consent: string }>).detail;
      setHasAnalyticsConsent(detail.consent === 'accepted');
    };

    window.addEventListener('cookie_consent_change', handleConsentChange);
    return () => {
      window.removeEventListener('cookie_consent_change', handleConsentChange);
    };
  }, []);

  // Do not render anything if there is no measurement ID or no consent
  if (!GA_MEASUREMENT_ID || !hasAnalyticsConsent) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            currency: localStorage.getItem('biocycle-currency') || 'CAD',
          });
        `}
      </Script>
    </>
  );
}
