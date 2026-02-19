'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Only import English (fallback) statically - all others loaded on demand
import en from '@/i18n/locales/en.json';

// Use Record<string, unknown> for locale files that may have partial translations.
type TranslationMessages = Record<string, Record<string, unknown>>;

// Supported locales (used for validation)
const SUPPORTED_LOCALES = new Set([
  'en', 'fr', 'zh', 'pa', 'es', 'tl', 'ar', 'ar-ma', 'ar-dz', 'ar-lb',
  'de', 'it', 'pt', 'hi', 'pl', 'vi', 'ko', 'ta', 'sv', 'ru', 'ht', 'gcr',
]);

// Cache loaded translations in memory (shared across all hook instances)
const loadedTranslations: TranslationMessages = { en };

// Dynamic import map - each locale loaded on demand (~250KB each instead of 5.6MB all)
async function loadLocale(locale: string): Promise<Record<string, unknown>> {
  if (loadedTranslations[locale]) return loadedTranslations[locale];

  try {
    let mod: { default: Record<string, unknown> };
    switch (locale) {
      case 'fr': mod = await import('@/i18n/locales/fr.json'); break;
      case 'zh': mod = await import('@/i18n/locales/zh.json'); break;
      case 'pa': mod = await import('@/i18n/locales/pa.json'); break;
      case 'es': mod = await import('@/i18n/locales/es.json'); break;
      case 'tl': mod = await import('@/i18n/locales/tl.json'); break;
      case 'ar': mod = await import('@/i18n/locales/ar.json'); break;
      case 'ar-ma': mod = await import('@/i18n/locales/ar-ma.json'); break;
      case 'ar-dz': mod = await import('@/i18n/locales/ar-dz.json'); break;
      case 'ar-lb': mod = await import('@/i18n/locales/ar-lb.json'); break;
      case 'de': mod = await import('@/i18n/locales/de.json'); break;
      case 'it': mod = await import('@/i18n/locales/it.json'); break;
      case 'pt': mod = await import('@/i18n/locales/pt.json'); break;
      case 'hi': mod = await import('@/i18n/locales/hi.json'); break;
      case 'pl': mod = await import('@/i18n/locales/pl.json'); break;
      case 'vi': mod = await import('@/i18n/locales/vi.json'); break;
      case 'ko': mod = await import('@/i18n/locales/ko.json'); break;
      case 'ta': mod = await import('@/i18n/locales/ta.json'); break;
      case 'sv': mod = await import('@/i18n/locales/sv.json'); break;
      case 'ru': mod = await import('@/i18n/locales/ru.json'); break;
      case 'ht': mod = await import('@/i18n/locales/ht.json'); break;
      case 'gcr': mod = await import('@/i18n/locales/gcr.json'); break;
      default: return en;
    }
    loadedTranslations[locale] = mod.default as Record<string, unknown>;
    return loadedTranslations[locale];
  } catch {
    return en;
  }
}

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

/** Read initial locale from server-rendered data-locale or cookie before defaulting */
function getInitialLocale(): string {
  if (typeof document !== 'undefined') {
    // 1. Check localStorage (user preference)
    const saved = localStorage.getItem('locale');
    if (saved && SUPPORTED_LOCALES.has(saved)) return saved;

    // 2. Check server-detected locale from <html data-locale="...">
    const serverLocale = document.documentElement.dataset.locale;
    if (serverLocale && SUPPORTED_LOCALES.has(serverLocale)) return serverLocale;

    // 3. Check cookie
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
    if (match && SUPPORTED_LOCALES.has(match[1])) return match[1];
  }
  return 'en';
}

export function useI18n() {
  const [locale, setLocale] = useState<string>(getInitialLocale);
  const [isLoaded, setIsLoaded] = useState(locale === 'en');
  const loadingRef = useRef<string | null>(null);

  // Load the locale translations on mount and when locale changes
  useEffect(() => {
    if (locale === 'en') {
      setIsLoaded(true);
      return;
    }

    // Avoid duplicate loads
    if (loadingRef.current === locale && loadedTranslations[locale]) {
      setIsLoaded(true);
      return;
    }

    loadingRef.current = locale;
    setIsLoaded(!!loadedTranslations[locale]);

    loadLocale(locale).then(() => {
      if (loadingRef.current === locale) {
        setIsLoaded(true);
      }
    });
  }, [locale]);

  useEffect(() => {
    // Re-check on mount (SSR may have rendered with 'en' before hydration)
    const savedLang = localStorage.getItem('locale');
    if (savedLang && SUPPORTED_LOCALES.has(savedLang)) {
      setLocale(savedLang);
    }

    // Listen for language changes
    const handleStorageChange = () => {
      const newLang = localStorage.getItem('locale');
      if (newLang && SUPPORTED_LOCALES.has(newLang)) {
        setLocale(newLang);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const currentTranslations = loadedTranslations[locale] || en;
    let text = getNestedValue(currentTranslations as Record<string, unknown>, key);

    // Fallback to English if key not found in current locale
    if (text === key && locale !== 'en') {
      text = getNestedValue(en as Record<string, unknown>, key);
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
    if (SUPPORTED_LOCALES.has(newLocale)) {
      setLocale(newLocale);
      localStorage.setItem('locale', newLocale);
      // Preload the locale
      loadLocale(newLocale);
    }
  }, []);

  return {
    t,
    locale,
    changeLocale,
    isLoaded,
  };
}
