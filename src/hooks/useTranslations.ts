/**
 * useTranslations - Standalone translation hook with dynamic locale loading
 *
 * Unlike useI18n() from I18nProvider (which receives messages from the server),
 * this hook dynamically imports only the active locale JSON on the client side.
 * This avoids bundling all 22 locale files (~8 MB) into the client JS.
 *
 * Features:
 * - Lazy-loads locale files via dynamic import()
 * - Module-level cache: switching back to a locale is instant
 * - English loaded eagerly as fallback (small and commonly needed)
 * - Dot-notation key resolution (e.g. "account.settings.title")
 * - Parameter interpolation: t("hello", { name: "World" }) => "Hello {name}" => "Hello World"
 * - Loading state while locale is being fetched
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { type Locale, defaultLocale, localeDirections } from '@/i18n/config';

// Nested message structure matching the locale JSON files
type Messages = Record<string, unknown>;

// Module-level cache so locales persist across re-renders and component mounts.
// Switching back to a previously loaded locale is instant (no re-fetch).
const localeCache = new Map<string, Messages>();

// Pre-load English synchronously as it is the default fallback.
// English is statically imported so it is always available immediately.
// This is the ONLY static import; all other locales are loaded on demand.
import enMessages from '@/i18n/locales/en.json';
localeCache.set('en', enMessages as Messages);

/**
 * Resolve the active locale from the DOM.
 * The root layout sets <html lang="..." data-locale="...">.
 */
function getLocaleFromDOM(): Locale {
  if (typeof document === 'undefined') return defaultLocale;
  return (
    (document.documentElement.getAttribute('data-locale') as Locale) ||
    (document.documentElement.lang as Locale) ||
    defaultLocale
  );
}

/**
 * Dynamically import a locale JSON file.
 * Next.js will code-split each locale into its own chunk.
 */
async function loadLocale(locale: string): Promise<Messages> {
  // Return from cache if already loaded
  if (localeCache.has(locale)) {
    return localeCache.get(locale)!;
  }

  try {
    // Dynamic import - Next.js creates a separate chunk for each locale
    const mod = await import(`@/i18n/locales/${locale}.json`);
    const messages: Messages = mod.default ?? mod;
    localeCache.set(locale, messages);
    return messages;
  } catch {
    // If the locale file fails to load, fall back to English
    console.warn(`[useTranslations] Failed to load locale "${locale}", falling back to English`);
    return localeCache.get('en') ?? enMessages;
  }
}

/**
 * Resolve a dot-notation key against a nested messages object.
 * e.g. resolve("account.settings.title", messages) walks messages.account.settings.title
 */
function resolveKey(key: string, messages: Messages): string | undefined {
  const keys = key.split('.');
  let value: unknown = messages;

  for (const k of keys) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[k];
  }

  return typeof value === 'string' ? value : undefined;
}

/**
 * Interpolate parameters into a translated string.
 * Replaces {paramName} placeholders with provided values.
 */
function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, paramKey) => {
    return params[paramKey] !== undefined ? String(params[paramKey]) : `{${paramKey}}`;
  });
}

export interface UseTranslationsReturn {
  /** Translate a key. Returns the key itself if not found. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Pluralized translation using Intl.PluralRules. */
  tp: (key: string, count: number, params?: Record<string, string | number>) => string;
  /** Current active locale */
  locale: Locale;
  /** True while the locale file is being loaded (only for non-English locales) */
  isLoading: boolean;
  /** Text direction for the current locale */
  dir: 'ltr' | 'rtl';
}

/**
 * Standalone translation hook with dynamic locale loading.
 *
 * Usage:
 * ```tsx
 * const { t, locale, isLoading } = useTranslations();
 * return <h1>{t('shop.title')}</h1>;
 * ```
 */
export function useTranslations(): UseTranslationsReturn {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Messages>(enMessages as Messages);
  const [isLoading, setIsLoading] = useState(false);

  // Track the latest requested locale to avoid race conditions
  const latestLocaleRef = useRef<string>(defaultLocale);

  // Detect locale from DOM on mount and when it changes
  useEffect(() => {
    const detectedLocale = getLocaleFromDOM();
    setLocale(detectedLocale);
  }, []);

  // Load messages when locale changes
  useEffect(() => {
    const currentLocale = locale;
    latestLocaleRef.current = currentLocale;

    // If already cached, apply immediately (no loading state)
    if (localeCache.has(currentLocale)) {
      setMessages(localeCache.get(currentLocale)!);
      setIsLoading(false);
      return;
    }

    // Not cached - show loading state and fetch
    setIsLoading(true);

    loadLocale(currentLocale).then((loaded) => {
      // Only apply if this is still the latest requested locale
      if (latestLocaleRef.current === currentLocale) {
        setMessages(loaded);
        setIsLoading(false);
      }
    });
  }, [locale]);

  // Translation function
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      // Try current locale messages
      const value = resolveKey(key, messages);
      if (value !== undefined) {
        return interpolate(value, params);
      }

      // Fallback to English if current locale is not English
      if (locale !== 'en') {
        const fallbackMessages = localeCache.get('en');
        if (fallbackMessages) {
          const fallbackValue = resolveKey(key, fallbackMessages);
          if (fallbackValue !== undefined) {
            return interpolate(fallbackValue, params);
          }
        }
      }

      // Key not found in any locale - return the key itself
      return key;
    },
    [messages, locale]
  );

  // Pluralized translation using Intl.PluralRules
  const tp = useCallback(
    (key: string, count: number, params?: Record<string, string | number>): string => {
      const pluralRule = new Intl.PluralRules(locale);
      const category = pluralRule.select(count);

      const allParams = { ...params, count };

      // Try specific plural form first (e.g. items_one, items_few)
      const pluralKey = `${key}_${category}`;
      const pluralResult = t(pluralKey, allParams);
      if (pluralResult !== pluralKey) return pluralResult;

      // Try _other fallback
      const otherKey = `${key}_other`;
      const otherResult = t(otherKey, allParams);
      if (otherResult !== otherKey) return otherResult;

      // Fall back to base key
      return t(key, allParams);
    },
    [locale, t]
  );

  return {
    t,
    tp,
    locale,
    isLoading,
    dir: localeDirections[locale] || 'ltr',
  };
}

export default useTranslations;
