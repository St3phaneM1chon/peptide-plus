/**
 * I18N - Système de traduction
 * 15 langues les plus parlées au Canada
 */

import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isValidLocale, type Locale } from './config';

// Import des fichiers de traduction
import en from './locales/en.json';
import fr from './locales/fr.json';
import zh from './locales/zh.json';
import pa from './locales/pa.json';
import es from './locales/es.json';
import tl from './locales/tl.json';
import ar from './locales/ar.json';
import arMa from './locales/ar-ma.json';
import arDz from './locales/ar-dz.json';
import arLb from './locales/ar-lb.json';
import de from './locales/de.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import hi from './locales/hi.json';
import pl from './locales/pl.json';
import vi from './locales/vi.json';
import ko from './locales/ko.json';
import ta from './locales/ta.json';
import sv from './locales/sv.json';
import ru from './locales/ru.json';
import ht from './locales/ht.json';
import gcr from './locales/gcr.json';

// Use a flexible type for locale files that may have partial translations.
// The fallback mechanism in getRequestConfig handles missing keys.
const messages: Record<string, Record<string, unknown>> = {
  en,
  fr,
  zh,
  pa,
  es,
  tl,
  ar,
  'ar-ma': arMa,
  'ar-dz': arDz,
  'ar-lb': arLb,
  de,
  it,
  pt,
  hi,
  pl,
  vi,
  ko,
  ta,
  sv,
  ru,
  ht,
  gcr,
};

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;

  // Load messages for the locale
  let localeMessages = messages[validLocale];

  // Fallback to default locale if not found
  if (!localeMessages) {
    localeMessages = messages[defaultLocale];
  }

  return {
    messages: localeMessages as Record<string, string>,
    timeZone: 'America/Toronto',
    now: new Date(),
  };
});

// Export types for use in components
export type Messages = typeof en;
export type MessageKey = keyof Messages;

// Utilitaires de formatage
export function formatCurrency(
  amount: number,
  locale: Locale = 'en',
  currency: string = 'CAD'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(
  date: Date | string,
  locale: Locale = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options || { dateStyle: 'long' }).format(d);
}

export function formatNumber(amount: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(locale).format(amount);
}

export function formatRelativeTime(
  date: Date | string,
  locale: Locale = 'en'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second');
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  } else if (diffInSeconds < 31536000) {
    return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month');
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year');
  }
}
