/**
 * ROOT LAYOUT - Application sécurisée
 * Dynamic locale loading based on cookie/header
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { cookies, headers } from 'next/headers';
import { defaultLocale, isValidLocale, type Locale, localeDirections } from '@/i18n/config';

// Import all locale files
import fr from '@/i18n/locales/fr.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import de from '@/i18n/locales/de.json';
import it from '@/i18n/locales/it.json';
import pt from '@/i18n/locales/pt.json';
import pl from '@/i18n/locales/pl.json';
import ru from '@/i18n/locales/ru.json';
import zh from '@/i18n/locales/zh.json';
import ko from '@/i18n/locales/ko.json';
import ar from '@/i18n/locales/ar.json';
import arDz from '@/i18n/locales/ar-dz.json';
import arLb from '@/i18n/locales/ar-lb.json';
import arMa from '@/i18n/locales/ar-ma.json';
import hi from '@/i18n/locales/hi.json';
import vi from '@/i18n/locales/vi.json';
import sv from '@/i18n/locales/sv.json';
import ht from '@/i18n/locales/ht.json';
import gcr from '@/i18n/locales/gcr.json';
import tl from '@/i18n/locales/tl.json';
import pa from '@/i18n/locales/pa.json';
import ta from '@/i18n/locales/ta.json';

const inter = Inter({ subsets: ['latin'] });

// Messages map - all supported locales
const messagesMap: Record<string, Record<string, any>> = {
  fr,
  en,
  es,
  de,
  it,
  pt,
  pl,
  ru,
  zh,
  ko,
  ar,
  'ar-dz': arDz,
  'ar-lb': arLb,
  'ar-ma': arMa,
  hi,
  vi,
  sv,
  ht,
  gcr,
  tl,
  pa,
  ta,
};

export const metadata: Metadata = {
  title: {
    template: '%s | BioCycle Peptides',
    default: 'BioCycle Peptides - Premium Research Peptides Canada',
  },
  description: 'BioCycle Peptides - Canada\'s trusted source for premium research peptides. Lab-tested, 99%+ purity, fast shipping.',
  robots: {
    index: true,
    follow: true,
  },
  referrer: 'strict-origin-when-cross-origin',
  keywords: ['peptides', 'research peptides', 'Canada', 'BPC-157', 'TB-500', 'Semaglutide', 'lab tested'],
  openGraph: {
    title: 'BioCycle Peptides - Premium Research Peptides',
    description: 'Canada\'s trusted source for premium research peptides. Lab-tested, 99%+ purity.',
    url: 'https://biocyclepeptides.com',
    siteName: 'BioCycle Peptides',
    locale: 'en_CA',
    type: 'website',
  },
};

// Helper to detect locale from Accept-Language header
function getLocaleFromAcceptLanguage(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  
  const langs = acceptLanguage.split(',').map(lang => {
    const [code] = lang.trim().split(';');
    return code.toLowerCase();
  });
  
  for (const lang of langs) {
    // Check for exact match (e.g., ar-ma)
    if (isValidLocale(lang)) {
      return lang as Locale;
    }
    // Check prefix match (e.g., fr-CA -> fr)
    const prefix = lang.split('-')[0];
    if (isValidLocale(prefix)) {
      return prefix as Locale;
    }
  }
  
  return defaultLocale;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let locale: Locale = defaultLocale;
  
  try {
    // Get locale from cookie first, then accept-language header
    const cookieStore = await cookies();
    const headerStore = await headers();
    
    // 1. Check cookie (highest priority - user preference)
    const localeCookie = cookieStore.get('locale')?.value;
    if (localeCookie && isValidLocale(localeCookie)) {
      locale = localeCookie as Locale;
    } else {
      // 2. Check x-locale header set by middleware
      const xLocale = headerStore.get('x-locale');
      if (xLocale && isValidLocale(xLocale)) {
        locale = xLocale as Locale;
      } else {
        // 3. Fall back to accept-language
        const acceptLanguage = headerStore.get('accept-language');
        locale = getLocaleFromAcceptLanguage(acceptLanguage);
      }
    }
  } catch (error) {
    // Fallback to default locale if headers/cookies fail
    console.error('Error reading locale:', error);
    locale = defaultLocale;
  }
  
  // Get messages for the locale, fallback to English if not found
  const messages = messagesMap[locale] || messagesMap['en'];
  const dir = localeDirections[locale] || 'ltr';
  
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={inter.className}>
        <Providers locale={locale} messages={messages}>
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
