/**
 * I18N CONFIGURATION
 * Langues parlées au Canada/Québec
 * Ordre: Anglais, Français, Créoles, puis alphabétique
 */

export const locales = [
  // Langues principales
  'en',      // Anglais (défaut)
  'fr',      // Français
  // Créoles
  'ht',      // Créole haïtien
  'gcr',     // Créole antillais (Guadeloupe/Martinique)
  // Arabes
  'ar',      // Arabe standard
  'ar-dz',   // Arabe algérien
  'ar-lb',   // Arabe libanais
  'ar-ma',   // Arabe marocain (Darija)
  // Autres (alphabétique)
  'zh',      // Chinois
  'de',      // Allemand
  'es',      // Espagnol
  'tl',      // Filipino/Tagalog
  'hi',      // Hindi
  'it',      // Italien
  'ko',      // Coréen
  'pl',      // Polonais
  'pt',      // Portugais
  'pa',      // Pendjabi
  'ru',      // Russe
  'sv',      // Suédois
  'ta',      // Tamoul
  'vi',      // Vietnamien
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  zh: '中文',
  pa: 'ਪੰਜਾਬੀ',
  es: 'Español',
  tl: 'Filipino',
  ar: 'العربية',
  'ar-ma': 'الدارجة المغربية',
  'ar-dz': 'الدارجة الجزائرية',
  'ar-lb': 'اللبنانية',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  hi: 'हिन्दी',
  pl: 'Polski',
  vi: 'Tiếng Việt',
  ko: '한국어',
  ta: 'தமிழ்',
  sv: 'Svenska',
  ru: 'Русский',
  ht: 'Kreyòl Ayisyen',
  gcr: 'Kréyòl Antiyé',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇨🇦',
  fr: '🇨🇦',
  zh: '🇨🇳',
  pa: '🇮🇳',
  es: '🇪🇸',
  tl: '🇵🇭',
  ar: '🇸🇦',
  'ar-ma': '🇲🇦',
  'ar-dz': '🇩🇿',
  'ar-lb': '🇱🇧',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
  hi: '🇮🇳',
  pl: '🇵🇱',
  vi: '🇻🇳',
  ko: '🇰🇷',
  ta: '🇮🇳',
  sv: '🇸🇪',
  ru: '🇷🇺',
  ht: '🇭🇹',
  gcr: '🇬🇵',
};

// Direction du texte (RTL pour l'arabe)
export const localeDirections: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  fr: 'ltr',
  zh: 'ltr',
  pa: 'ltr',
  es: 'ltr',
  tl: 'ltr',
  ar: 'rtl',
  'ar-ma': 'rtl',
  'ar-dz': 'rtl',
  'ar-lb': 'rtl',
  de: 'ltr',
  it: 'ltr',
  pt: 'ltr',
  hi: 'ltr',
  pl: 'ltr',
  vi: 'ltr',
  ko: 'ltr',
  ta: 'ltr',
  sv: 'ltr',
  ru: 'ltr',
  ht: 'ltr',
  gcr: 'ltr',
};

// Formats de date par locale
export const localeDateFormats: Record<Locale, Intl.DateTimeFormatOptions> = {
  en: { dateStyle: 'long', timeStyle: 'short' },
  fr: { dateStyle: 'long', timeStyle: 'short' },
  zh: { dateStyle: 'long', timeStyle: 'short' },
  pa: { dateStyle: 'long', timeStyle: 'short' },
  es: { dateStyle: 'long', timeStyle: 'short' },
  tl: { dateStyle: 'long', timeStyle: 'short' },
  ar: { dateStyle: 'long', timeStyle: 'short' },
  'ar-ma': { dateStyle: 'long', timeStyle: 'short' },
  'ar-dz': { dateStyle: 'long', timeStyle: 'short' },
  'ar-lb': { dateStyle: 'long', timeStyle: 'short' },
  de: { dateStyle: 'long', timeStyle: 'short' },
  it: { dateStyle: 'long', timeStyle: 'short' },
  pt: { dateStyle: 'long', timeStyle: 'short' },
  hi: { dateStyle: 'long', timeStyle: 'short' },
  pl: { dateStyle: 'long', timeStyle: 'short' },
  vi: { dateStyle: 'long', timeStyle: 'short' },
  ko: { dateStyle: 'long', timeStyle: 'short' },
  ta: { dateStyle: 'long', timeStyle: 'short' },
  sv: { dateStyle: 'long', timeStyle: 'short' },
  ru: { dateStyle: 'long', timeStyle: 'short' },
  ht: { dateStyle: 'long', timeStyle: 'short' },
  gcr: { dateStyle: 'long', timeStyle: 'short' },
};

// Default base currency (overridden at runtime by SiteSettings.defaultCurrency)
export const DEFAULT_CURRENCY = 'CAD';

/**
 * Get currency format for a locale.
 * Currency is dynamic — defaults to DEFAULT_CURRENCY but can be overridden
 * at runtime via CurrencyContext (user selection from DB).
 */
export function getCurrencyFormat(currencyCode?: string): { currency: string; style: 'currency' } {
  return { currency: currencyCode || DEFAULT_CURRENCY, style: 'currency' };
}

// Legacy export for backward compat — uses default currency
export const localeCurrencyFormats: Record<Locale, { currency: string; style: 'currency' }> = Object.fromEntries(
  locales.map((l) => [l, { currency: DEFAULT_CURRENCY, style: 'currency' as const }])
) as Record<Locale, { currency: string; style: 'currency' }>;

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
      return { locale: locale.toLowerCase(), quality: q };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find first matching locale
  for (const { locale } of languages) {
    // Chercher correspondance exacte (ex: ar-ma, ar-dz)
    if (isValidLocale(locale)) {
      return locale;
    }
    
    // Chercher par préfixe (ex: fr-CA -> fr)
    const prefix = locale.split('-')[0];
    
    // Cas spécial pour l'arabe: essayer de matcher le dialecte
    if (prefix === 'ar') {
      // Vérifier si c'est un dialecte supporté
      const arabicDialects = ['ar-ma', 'ar-dz', 'ar-lb'];
      if (arabicDialects.includes(locale) && isValidLocale(locale as Locale)) {
        return locale as Locale;
      }
      // Sinon retourner arabe standard
      return 'ar';
    }
    
    // Pour les autres langues
    if (isValidLocale(prefix)) {
      return prefix;
    }
  }

  return defaultLocale;
}
