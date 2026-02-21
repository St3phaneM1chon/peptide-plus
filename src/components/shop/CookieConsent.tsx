'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function CookieConsent() {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const acceptButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Show after a small delay
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  // Auto-focus Accept button when dialog becomes visible
  useEffect(() => {
    if (isVisible && acceptButtonRef.current) {
      acceptButtonRef.current.focus();
    }
  }, [isVisible]);

  /**
   * Persist consent choice to the backend API for RGPD/GDPR proof.
   * Runs in the background so the banner dismisses instantly.
   */
  const saveConsentToBackend = (accepted: boolean) => {
    const payload = {
      analytics: accepted,
      marketing: accepted,
      personalization: accepted,
    };

    fetch('/api/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silent catch - localStorage already records the choice for UI,
      // and a retry could be attempted on next page load if needed.
    });
  };

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setIsVisible(false);
    saveConsentToBackend(true);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    setIsVisible(false);
    saveConsentToBackend(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="alertdialog"
      aria-describedby="cookie-consent-description"
      aria-label={t('cookies.title')}
      className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg md:p-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🍪</span>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {t('cookies.title') || 'We use cookies'}
                </h3>
                <p id="cookie-consent-description" className="text-sm text-gray-600">
                  {t('cookies.message') || 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept", you consent to our use of cookies.'}
                  {' '}
                  <Link href="/mentions-legales/cookies" className="text-orange-600 hover:underline">
                    {t('cookies.learnMore') || 'Learn more'}
                  </Link>
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 ms-9 md:ms-0">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              {t('cookies.decline') || 'Decline'}
            </button>
            <button
              ref={acceptButtonRef}
              onClick={handleAccept}
              className="px-6 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              {t('cookies.accept') || 'Accept'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
