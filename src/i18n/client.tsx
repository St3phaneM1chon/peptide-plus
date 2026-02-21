/**
 * I18N CLIENT
 * Hooks et contexte pour la traduction côté client
 */

'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { type Locale, defaultLocale, locales, localeNames, localeFlags, localeDirections } from './config';

// Messages type
type Messages = Record<string, unknown>;

interface I18nContextType {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tp: (key: string, count: number, params?: Record<string, string | number>) => string;
  formatDate: (date: Date | string) => string;
  formatCurrency: (amount: number) => string;
  formatNumber: (amount: number) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
}

export function I18nProvider({ children, locale: initialLocale, messages }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  usePathname(); // For router updates

  // Charger la locale sauvegardée
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && locales.includes(savedLocale) && savedLocale !== locale) {
      setLocaleState(savedLocale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mettre à jour la direction du document
  useEffect(() => {
    document.documentElement.dir = localeDirections[locale];
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(async (newLocale: Locale) => {
    if (!locales.includes(newLocale)) return;

    // Sauvegarder la préférence dans localStorage
    localStorage.setItem('locale', newLocale);
    
    // Sauvegarder dans un cookie pour que le serveur le détecte
    document.cookie = `locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;

    // Mettre à jour en base de données si connecté
    try {
      await fetch('/api/user/locale', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });
    } catch {
      // Ignore errors - locale is saved locally anyway
    }

    setLocaleState(newLocale);

    // Forcer un rechargement complet pour que le serveur utilise la nouvelle locale
    window.location.reload();
  }, []);

  // Fonction de traduction
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: unknown = messages;

    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
      if (value === undefined) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key is not a string: ${key}`);
      return key;
    }

    // Remplacer les paramètres {param}
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return String(params[paramKey] ?? `{${paramKey}}`);
      });
    }

    return value;
  }, [messages]);

  // Fonction de traduction pluralisée
  // Utilise Intl.PluralRules pour supporter toutes les formes plurielles
  // (ex: arabe a 6 formes, polonais 3, russe 3, etc.)
  // Convention: clés avec suffixes _zero, _one, _two, _few, _many, _other
  const tp = useCallback((key: string, count: number, params?: Record<string, string | number>): string => {
    const pluralRule = new Intl.PluralRules(locale);
    const category = pluralRule.select(count); // 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

    const allParams = { ...params, count };

    // Try specific plural form first, then _other fallback, then base key
    const pluralKey = `${key}_${category}`;
    const otherKey = `${key}_other`;

    const pluralResult = t(pluralKey, allParams);
    if (pluralResult !== pluralKey) return pluralResult;

    const otherResult = t(otherKey, allParams);
    if (otherResult !== otherKey) return otherResult;

    return t(key, allParams);
  }, [locale, t]);

  // Formatage de date
  const formatDate = useCallback((date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(d);
  }, [locale]);

  // Formatage de devise
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'CAD',
    }).format(amount);
  }, [locale]);

  // Formatage de nombre
  const formatNumber = useCallback((amount: number): string => {
    return new Intl.NumberFormat(locale).format(amount);
  }, [locale]);

  const contextValue: I18nContextType = {
    locale,
    messages,
    setLocale,
    t,
    tp,
    formatDate,
    formatCurrency,
    formatNumber,
    dir: localeDirections[locale],
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

// Hook principal
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Hook pour la traduction uniquement
export function useTranslation() {
  const { t, tp, locale } = useI18n();
  return { t, tp, locale };
}

// Hook pour le formatage
export function useFormat() {
  const { formatDate, formatCurrency, formatNumber, locale } = useI18n();
  return { formatDate, formatCurrency, formatNumber, locale };
}

// Export des utilitaires
export { locales, localeNames, localeFlags, localeDirections, defaultLocale };
export type { Locale };
