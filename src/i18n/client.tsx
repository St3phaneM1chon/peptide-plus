/**
 * I18N CLIENT
 * Hooks et contexte pour la traduction côté client
 *
 * PERF: The root layout passes only essential namespaces (~23KB) via RSC props.
 * This provider lazily loads the FULL locale JSON on the client via dynamic
 * import(), so the 540-686KB payload is never serialized through RSC.
 * The t() function works immediately with essential keys; remaining keys
 * resolve once the full locale finishes loading (typically <200ms).
 */

'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
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

// ---------------------------------------------------------------------------
// Module-level cache for full locale files (shared across mounts/re-renders)
// ---------------------------------------------------------------------------
const fullLocaleCache = new Map<string, Messages>();

/**
 * Dynamically import the FULL locale JSON.
 * Next.js code-splits each locale into its own chunk.
 */
async function loadFullLocale(locale: string): Promise<Messages> {
  if (fullLocaleCache.has(locale)) {
    return fullLocaleCache.get(locale)!;
  }
  try {
    const mod = await import(`@/i18n/locales/${locale}.json`);
    const msgs: Messages = mod.default ?? mod;
    fullLocaleCache.set(locale, msgs);
    return msgs;
  } catch {
    // Fallback: try English
    if (locale !== 'en') {
      return loadFullLocale('en');
    }
    return {};
  }
}

// ---------------------------------------------------------------------------
// Deep merge: overlay full locale on top of essential (server) messages.
// This ensures any key present in either source is available.
// ---------------------------------------------------------------------------
function deepMerge(base: Messages, overlay: Messages): Messages {
  const result: Messages = { ...base };
  for (const key of Object.keys(overlay)) {
    const baseVal = base[key];
    const overVal = overlay[key];
    if (
      baseVal && overVal &&
      typeof baseVal === 'object' && !Array.isArray(baseVal) &&
      typeof overVal === 'object' && !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(baseVal as Messages, overVal as Messages);
    } else {
      result[key] = overVal;
    }
  }
  return result;
}

interface I18nProviderProps {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
}

export function I18nProvider({ children, locale: initialLocale, messages: serverMessages }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  // Start with the essential (server-provided) messages; full locale merges in later
  const [messages, setMessages] = useState<Messages>(serverMessages);
  const latestLocaleRef = useRef<string>(initialLocale);
  usePathname(); // For router updates

  // ------------------------------------------------------------------
  // PERF: Lazily load the FULL locale JSON on mount (client-side only).
  // The server only sends essential namespaces (~23KB). This dynamic
  // import loads the remaining ~500KB as a separate JS chunk, avoiding
  // the RSC serialization cost entirely.
  // ------------------------------------------------------------------
  useEffect(() => {
    const currentLocale = locale;
    latestLocaleRef.current = currentLocale;

    // If we already have the full locale cached, merge immediately
    if (fullLocaleCache.has(currentLocale)) {
      setMessages(deepMerge(serverMessages, fullLocaleCache.get(currentLocale)!));
      return;
    }

    // Load asynchronously
    loadFullLocale(currentLocale).then((full) => {
      if (latestLocaleRef.current === currentLocale) {
        setMessages(deepMerge(serverMessages, full));
      }
    });
  }, [locale, serverMessages]);

  // Charger la locale sauvegardée
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale;
    if (savedLocale && locales.includes(savedLocale) && savedLocale !== initialLocale) {
      setLocaleState(savedLocale);
    }
  }, [initialLocale]);

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
        // Don't warn during initial load — key may arrive with full locale
        return key;
      }
    }

    if (typeof value !== 'string') {
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

  // Formatage de devise (reads user's selected currency from localStorage)
  const formatCurrency = useCallback((amount: number, currency?: string): string => {
    const cur = currency || (typeof window !== 'undefined' && localStorage.getItem('biocycle-currency')) || 'CAD';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cur,
    }).format(amount);
  }, [locale]);

  // Formatage de nombre
  const formatNumber = useCallback((amount: number): string => {
    return new Intl.NumberFormat(locale).format(amount);
  }, [locale]);

  const dir = localeDirections[locale];

  const contextValue: I18nContextType = useMemo(() => ({
    locale,
    messages,
    setLocale,
    t,
    tp,
    formatDate,
    formatCurrency,
    formatNumber,
    dir,
  }), [locale, messages, setLocale, t, tp, formatDate, formatCurrency, formatNumber, dir]);

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
