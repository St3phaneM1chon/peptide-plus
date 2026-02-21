'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * GDPR-compliant Meta (Facebook) Pixel loader.
 *
 * The pixel script is ONLY injected when the user has explicitly accepted cookies
 * via the CookieConsent banner (localStorage key `cookie_consent` === 'accepted').
 *
 * - If consent has not been given yet: Pixel does NOT load.
 * - If consent is declined: Pixel does NOT load.
 * - If consent is accepted after page load: Pixel loads immediately via the
 *   `cookie_consent_change` custom event dispatched by CookieConsent.
 */
export function MetaPixel() {
  const [hasMarketingConsent, setHasMarketingConsent] = useState(false);

  useEffect(() => {
    // Check initial consent state from localStorage
    const consent = localStorage.getItem('cookie_consent');
    setHasMarketingConsent(consent === 'accepted');

    // Listen for real-time consent changes from the CookieConsent banner
    const handleConsentChange = (e: Event) => {
      const detail = (e as CustomEvent<{ consent: string }>).detail;
      setHasMarketingConsent(detail.consent === 'accepted');
    };

    window.addEventListener('cookie_consent_change', handleConsentChange);
    return () => {
      window.removeEventListener('cookie_consent_change', handleConsentChange);
    };
  }, []);

  // Do not render anything if there is no pixel ID or no consent
  if (!META_PIXEL_ID || !hasMarketingConsent) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
