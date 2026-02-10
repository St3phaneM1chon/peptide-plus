'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { useCurrency } from '@/contexts/CurrencyContext';

export default function FreeShippingBanner() {
  const { t } = useTranslations();
  const { formatPrice } = useCurrency();
  const [isVisible, setIsVisible] = useState(true);

  // Hide banner on scroll down, show on scroll up
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const freeShippingThreshold = 150; // CAD

  return (
    <div
      className={`bg-gradient-to-r from-orange-500 to-orange-600 text-white text-center py-2 px-4 text-sm font-medium transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 h-0 py-0'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          🚚 {t('shop.freeShipping')}
        </span>
        <span className="hidden sm:inline">|</span>
        <span>
          {t('shop.freeShippingOver', { amount: formatPrice(freeShippingThreshold) }) || 
           `Free shipping on orders over ${formatPrice(freeShippingThreshold)}`}
        </span>
        <span className="hidden md:inline">|</span>
        <span className="hidden md:flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {t('shop.labTested')} • {t('shop.avgPurity')}
        </span>
      </div>
    </div>
  );
}
