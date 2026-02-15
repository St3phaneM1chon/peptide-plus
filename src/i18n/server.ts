/**
 * I18N SERVER UTILITIES
 * Traductions côté serveur pour API routes, emails, PDFs
 */

import { headers, cookies } from 'next/headers';
import { type Locale, defaultLocale, isValidLocale, getLocaleFromHeaders } from './config';

// Import des messages (toutes les 22 locales)
import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';
import arDz from './locales/ar-dz.json';
import arLb from './locales/ar-lb.json';
import arMa from './locales/ar-ma.json';
import de from './locales/de.json';
import es from './locales/es.json';
import gcr from './locales/gcr.json';
import hi from './locales/hi.json';
import ht from './locales/ht.json';
import it from './locales/it.json';
import ko from './locales/ko.json';
import pa from './locales/pa.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import sv from './locales/sv.json';
import ta from './locales/ta.json';
import tl from './locales/tl.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';

const allMessages: Partial<Record<Locale, Record<string, unknown>>> = {
  en, fr, ar, 'ar-dz': arDz, 'ar-lb': arLb, 'ar-ma': arMa,
  de, es, gcr, hi, ht, it, ko, pa, pl, pt, ru, sv, ta, tl, vi, zh,
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
export function getMessages(locale: Locale = defaultLocale): Record<string, unknown> {
  return allMessages[locale] || allMessages[defaultLocale] || fr;
}

/**
 * Fonction de traduction serveur
 */
export function createServerTranslator(locale: Locale = defaultLocale) {
  const messages = getMessages(locale);
  const fallback = locale !== 'en' ? getMessages('en' as Locale) : messages;

  return function t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.');

    // Try current locale
    let value: unknown = messages;
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
      if (value === undefined) break;
    }

    // Fallback to English
    if (value === undefined || typeof value !== 'string') {
      value = fallback;
      for (const k of keys) {
        value = (value as Record<string, unknown>)?.[k];
        if (value === undefined) break;
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
