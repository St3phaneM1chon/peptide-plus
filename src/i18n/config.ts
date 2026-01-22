/**
 * I18N CONFIGURATION
 * Configuration du système de traduction multilingue
 */

export const locales = ['fr', 'en', 'es', 'de', 'it', 'pt', 'zh', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fr';

export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  zh: '中文',
  ar: 'العربية',
};

export const localeFlags: Record<Locale, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  es: '🇪🇸',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
  zh: '🇨🇳',
  ar: '🇸🇦',
};

// Direction du texte (RTL pour l'arabe)
export const localeDirections: Record<Locale, 'ltr' | 'rtl'> = {
  fr: 'ltr',
  en: 'ltr',
  es: 'ltr',
  de: 'ltr',
  it: 'ltr',
  pt: 'ltr',
  zh: 'ltr',
  ar: 'rtl',
};

// Formats de date par locale
export const localeDateFormats: Record<Locale, Intl.DateTimeFormatOptions> = {
  fr: { dateStyle: 'long', timeStyle: 'short' },
  en: { dateStyle: 'long', timeStyle: 'short' },
  es: { dateStyle: 'long', timeStyle: 'short' },
  de: { dateStyle: 'long', timeStyle: 'short' },
  it: { dateStyle: 'long', timeStyle: 'short' },
  pt: { dateStyle: 'long', timeStyle: 'short' },
  zh: { dateStyle: 'long', timeStyle: 'short' },
  ar: { dateStyle: 'long', timeStyle: 'short' },
};

// Formats de devise par locale
export const localeCurrencyFormats: Record<Locale, { currency: string; style: 'currency' }> = {
  fr: { currency: 'CAD', style: 'currency' },
  en: { currency: 'CAD', style: 'currency' },
  es: { currency: 'CAD', style: 'currency' },
  de: { currency: 'EUR', style: 'currency' },
  it: { currency: 'EUR', style: 'currency' },
  pt: { currency: 'EUR', style: 'currency' },
  zh: { currency: 'CNY', style: 'currency' },
  ar: { currency: 'SAR', style: 'currency' },
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function getLocaleFromHeaders(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [locale, quality = 'q=1.0'] = lang.trim().split(';');
      const q = parseFloat(quality.replace('q=', ''));
      return { locale: locale.split('-')[0], quality: q };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find first matching locale
  for (const { locale } of languages) {
    if (isValidLocale(locale)) {
      return locale;
    }
  }

  return defaultLocale;
}
