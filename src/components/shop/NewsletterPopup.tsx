'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from '@/hooks/useTranslations';

export default function NewsletterPopup() {
  const { t, locale } = useTranslations();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Don't show to logged-in users (they already have an account)
    if (session?.user) {
      return;
    }

    // Check if user has already seen the popup or subscribed
    const hasSeenPopup = localStorage.getItem('newsletter_popup_seen');
    const hasSubscribed = localStorage.getItem('newsletter_subscribed');

    if (hasSeenPopup || hasSubscribed) {
      return;
    }

    // Check if disclaimer was already accepted
    const disclaimerAccepted = localStorage.getItem('biocycle_disclaimer_accepted');
    if (disclaimerAccepted) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 5000);
      return () => clearTimeout(timer);
    }

    // Listen for disclaimer acceptance event
    const handleDisclaimerAccepted = () => {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 3000);
      // Clean up timer if component unmounts
      return () => clearTimeout(timer);
    };

    window.addEventListener('disclaimerAccepted', handleDisclaimerAccepted);
    return () => {
      window.removeEventListener('disclaimerAccepted', handleDisclaimerAccepted);
    };
  }, [session]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('newsletter_popup_seen', 'true');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Save to backend API
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'popup',
          locale: locale || 'en',
          ...(birthDate && { birthDate }),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to subscribe');
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      // Still continue to show success - local storage backup
    }
    
    // Save subscription locally as backup
    localStorage.setItem('newsletter_subscribed', 'true');
    localStorage.setItem('newsletter_email', email);
    if (birthDate) {
      localStorage.setItem('newsletter_birthdate', birthDate);
    }
    
    // Generate discount code
    const discountCode = `WELCOME10-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    localStorage.setItem('discount_code', discountCode);
    
    setIsLoading(false);
    setIsSubmitted(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors z-10"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {!isSubmitted ? (
          <>
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-8 text-white text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                <span className="text-3xl">💊</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                {t('newsletter.title')}
              </h2>
              <p className="text-orange-100">
                {t('newsletter.subtitle')}
              </p>
            </div>

            {/* Form */}
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="newsletter-email" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('newsletter.emailLabel')}
                  </label>
                  <input
                    type="email"
                    id="newsletter-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('newsletter.placeholder')}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="newsletter-dob" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('newsletter.dobLabel', 'Date of Birth')} <span className="text-xs text-gray-400">({t('newsletter.dobOptional', 'optional - for a birthday surprise!')})</span>
                  </label>
                  <input
                    type="date"
                    id="newsletter-dob"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('common.loading')}
                    </span>
                  ) : (
                    t('newsletter.cta')
                  )}
                </button>
              </form>

              {/* Benefits */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-3">
                  {t('newsletter.benefits')}
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('newsletter.benefit1')}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('newsletter.benefit2')}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('newsletter.benefit3')}
                  </li>
                </ul>
              </div>

              {/* Privacy note */}
              <p className="mt-4 text-xs text-gray-400 text-center">
                {t('newsletter.privacy')}
              </p>
            </div>
          </>
        ) : (
          /* Success State */
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('newsletter.successTitle')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('newsletter.successMessage')}
            </p>
            
            {/* Discount Code Display */}
            <div className="bg-orange-50 border-2 border-dashed border-orange-300 rounded-lg p-4 mb-6">
              <p className="text-sm text-orange-600 mb-1">
                {t('newsletter.yourCode')}
              </p>
              <p className="text-2xl font-bold text-orange-600 font-mono">WELCOME10</p>
            </div>
            
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              {t('newsletter.startShopping')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
