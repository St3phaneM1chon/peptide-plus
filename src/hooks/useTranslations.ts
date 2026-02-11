'use client';

import { useState, useEffect, useCallback } from 'react';

// Import all translations
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import zh from '@/i18n/locales/zh.json';
import pa from '@/i18n/locales/pa.json';
import es from '@/i18n/locales/es.json';
import tl from '@/i18n/locales/tl.json';
import ar from '@/i18n/locales/ar.json';
import arMa from '@/i18n/locales/ar-ma.json';
import arDz from '@/i18n/locales/ar-dz.json';
import arLb from '@/i18n/locales/ar-lb.json';
import de from '@/i18n/locales/de.json';
import it from '@/i18n/locales/it.json';
import pt from '@/i18n/locales/pt.json';
import hi from '@/i18n/locales/hi.json';
import pl from '@/i18n/locales/pl.json';
import vi from '@/i18n/locales/vi.json';
import ko from '@/i18n/locales/ko.json';
import ta from '@/i18n/locales/ta.json';
import sv from '@/i18n/locales/sv.json';
import ru from '@/i18n/locales/ru.json';
import ht from '@/i18n/locales/ht.json';
import gcr from '@/i18n/locales/gcr.json';

const translations: Record<string, typeof en> = {
  en,
  fr,
  zh,
  pa,
  es,
  tl,
  ar,
  'ar-ma': arMa as typeof en,
  'ar-dz': arDz as typeof en,
  'ar-lb': arLb as typeof en,
  de: de as typeof en,
  it: it as typeof en,
  pt: pt as typeof en,
  hi: hi as typeof en,
  pl: pl as typeof en,
  vi: vi as typeof en,
  ko: ko as typeof en,
  ta: ta as typeof en,
  sv: sv as typeof en,
  ru: ru as typeof en,
  ht: ht as typeof en,
  gcr: gcr as typeof en,
};

// Get nested value from object using dot notation
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let value: unknown = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return path; // Return the key if not found
    }
  }
  
  return typeof value === 'string' ? value : path;
}

export function useTranslations() {
  const [locale, setLocale] = useState<string>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Get language from localStorage (key = 'locale', matching Header.tsx)
    const savedLang = localStorage.getItem('locale');
    if (savedLang && translations[savedLang]) {
      setLocale(savedLang);
    }
    setIsLoaded(true);

    // Listen for language changes
    const handleStorageChange = () => {
      const newLang = localStorage.getItem('locale');
      if (newLang && translations[newLang]) {
        setLocale(newLang);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const currentTranslations = translations[locale] || translations.en;
    let text = getNestedValue(currentTranslations as Record<string, unknown>, key);
    
    // Fallback to English if key not found in current locale
    if (text === key && locale !== 'en') {
      text = getNestedValue(translations.en as Record<string, unknown>, key);
    }
    
    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(`{${paramKey}}`, String(value));
      });
    }
    
    return text;
  }, [locale]);

  const changeLocale = useCallback((newLocale: string) => {
    if (translations[newLocale]) {
      setLocale(newLocale);
      localStorage.setItem('locale', newLocale);
    }
  }, []);

  return {
    t,
    locale,
    changeLocale,
    isLoaded,
  };
}
