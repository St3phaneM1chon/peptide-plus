/**
 * I18N SERVER UTILITIES
 * Traductions côté serveur pour API routes, emails, PDFs
 */

import { headers, cookies } from 'next/headers';
import { type Locale, defaultLocale, isValidLocale, getLocaleFromHeaders } from './config';

// Import des messages
import fr from './locales/fr.json';
import en from './locales/en.json';
import es from './locales/es.json';

// Partial messages - only include actively maintained translations
const allMessages: Partial<Record<Locale, typeof fr>> = {
  fr,
  en,
  es,
  // Fallback pour les langues non encore traduites
  de: en,
  it: en,
  pt: en,
  zh: en,
  ar: en,
};

/**
 * Récupère la locale courante côté serveur
 */
export async function getServerLocale(): Promise<Locale> {
  // 1. Vérifier le header x-locale (défini par middleware)
  const headersList = await headers();
  const headerLocale = headersList.get('x-locale');
  if (headerLocale && isValidLocale(headerLocale)) {
    return headerLocale as Locale;
  }

  // 2. Vérifier le cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return cookieLocale as Locale;
  }

  // 3. Vérifier Accept-Language
  const acceptLanguage = headersList.get('accept-language');
  return getLocaleFromHeaders(acceptLanguage);
}

/**
 * Récupère les messages pour une locale
 */
export function getMessages(locale: Locale = defaultLocale): typeof fr {
  return allMessages[locale] || allMessages[defaultLocale] || fr;
}

/**
 * Fonction de traduction serveur
 */
export function createServerTranslator(locale: Locale = defaultLocale) {
  const messages = getMessages(locale);

  return function t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = messages;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn(`[i18n] Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`[i18n] Translation key is not a string: ${key}`);
      return key;
    }

    // Remplacer les paramètres {param}
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return String(params[paramKey] ?? `{${paramKey}}`);
      });
    }

    return value;
  };
}

/**
 * Formatage de devise côté serveur
 */
export function formatCurrencyServer(
  amount: number,
  locale: Locale = 'fr',
  currency: string = 'CAD'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Formatage de date côté serveur
 */
export function formatDateServer(
  date: Date | string,
  locale: Locale = 'fr',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options || { dateStyle: 'long' }).format(d);
}

/**
 * Formatage de date et heure côté serveur
 */
export function formatDateTimeServer(
  date: Date | string,
  locale: Locale = 'fr'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Formatage de nombre côté serveur
 */
export function formatNumberServer(amount: number, locale: Locale = 'fr'): string {
  return new Intl.NumberFormat(locale).format(amount);
}

// Export helper pour les API routes
export async function getApiTranslator() {
  const locale = await getServerLocale();
  return {
    t: createServerTranslator(locale),
    locale,
    formatCurrency: (amount: number, currency?: string) => 
      formatCurrencyServer(amount, locale, currency),
    formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => 
      formatDateServer(date, locale, options),
    formatDateTime: (date: Date | string) => 
      formatDateTimeServer(date, locale),
    formatNumber: (amount: number) => 
      formatNumberServer(amount, locale),
  };
}
