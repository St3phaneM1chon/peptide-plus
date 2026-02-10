'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function CookieConsent() {
  const { t } = useTranslations();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Show after a small delay
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookie_consent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🍪</span>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {t('cookies.title') || 'We use cookies'}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('cookies.message') || 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept", you consent to our use of cookies.'}
                  {' '}
                  <Link href="/mentions-legales/cookies" className="text-orange-600 hover:underline">
                    {t('cookies.learnMore') || 'Learn more'}
                  </Link>
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 ml-9 md:ml-0">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              {t('cookies.decline') || 'Decline'}
            </button>
            <button
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
