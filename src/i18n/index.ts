/**
 * I18N - Système de traduction
 * Utilise next-intl pour la gestion multilingue
 */

import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isValidLocale, type Locale } from './config';

// Import des fichiers de traduction
import fr from './locales/fr.json';
import en from './locales/en.json';
import es from './locales/es.json';

const messages: Record<string, typeof fr> = {
  fr,
  en,
  es,
  // Les autres langues seront chargées dynamiquement ou ajoutées ici
};

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  const validLocale = isValidLocale(locale) ? locale : defaultLocale;

  // Load messages for the locale
  let localeMessages = messages[validLocale];

  // Si pas encore chargé, essayer de charger dynamiquement
  if (!localeMessages) {
    try {
      localeMessages = (await import(`./locales/${validLocale}.json`)).default;
    } catch {
      // Fallback to default locale
      localeMessages = messages[defaultLocale];
    }
  }

  return {
    messages: localeMessages,
    timeZone: 'America/Toronto',
    now: new Date(),
  };
});

// Export types for use in components
export type Messages = typeof fr;
export type MessageKey = keyof Messages;

// Utilitaires de formatage
export function formatCurrency(
  amount: number,
  locale: Locale = 'fr',
  currency: string = 'CAD'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(
  date: Date | string,
  locale: Locale = 'fr',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options || { dateStyle: 'long' }).format(d);
}

export function formatNumber(amount: number, locale: Locale = 'fr'): string {
  return new Intl.NumberFormat(locale).format(amount);
}

export function formatRelativeTime(
  date: Date | string,
  locale: Locale = 'fr'
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
