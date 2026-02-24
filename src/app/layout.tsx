/**
 * ROOT LAYOUT - Application sécurisée
 * Dynamic locale loading based on cookie/header
 * Note: cookies()/headers() in this layout will make it dynamic per-request,
 * but child pages can still be statically generated via generateStaticParams.
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { cookies, headers } from 'next/headers';
import { locales, defaultLocale, isValidLocale, type Locale, localeDirections } from '@/i18n/config';
import Script from 'next/script';
import { JsonLd } from '@/components/seo/JsonLd';
import { organizationSchema, websiteSchema } from '@/lib/structured-data';
import { TranslationNotice } from '@/components/ui/TranslationNotice';
import { TranslationFeedback } from '@/components/ui/TranslationFeedback';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { MetaPixel } from '@/components/analytics/MetaPixel';
import { logger } from '@/lib/logger';

// Only import en/fr statically (most common); others loaded dynamically
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Dynamic locale loader - only loads the needed locale on demand (server-side)
const localeLoaders: Record<string, () => Promise<Record<string, unknown>>> = {
  en: () => Promise.resolve(en),
  fr: () => Promise.resolve(fr),
  es: () => import('@/i18n/locales/es.json').then(m => m.default),
  de: () => import('@/i18n/locales/de.json').then(m => m.default),
  it: () => import('@/i18n/locales/it.json').then(m => m.default),
  pt: () => import('@/i18n/locales/pt.json').then(m => m.default),
  pl: () => import('@/i18n/locales/pl.json').then(m => m.default),
  ru: () => import('@/i18n/locales/ru.json').then(m => m.default),
  zh: () => import('@/i18n/locales/zh.json').then(m => m.default),
  ko: () => import('@/i18n/locales/ko.json').then(m => m.default),
  ar: () => import('@/i18n/locales/ar.json').then(m => m.default),
  'ar-dz': () => import('@/i18n/locales/ar-dz.json').then(m => m.default),
  'ar-lb': () => import('@/i18n/locales/ar-lb.json').then(m => m.default),
  'ar-ma': () => import('@/i18n/locales/ar-ma.json').then(m => m.default),
  hi: () => import('@/i18n/locales/hi.json').then(m => m.default),
  vi: () => import('@/i18n/locales/vi.json').then(m => m.default),
  sv: () => import('@/i18n/locales/sv.json').then(m => m.default),
  ht: () => import('@/i18n/locales/ht.json').then(m => m.default),
  gcr: () => import('@/i18n/locales/gcr.json').then(m => m.default),
  tl: () => import('@/i18n/locales/tl.json').then(m => m.default),
  pa: () => import('@/i18n/locales/pa.json').then(m => m.default),
  ta: () => import('@/i18n/locales/ta.json').then(m => m.default),
};

async function loadMessages(locale: string): Promise<Record<string, unknown>> {
  const loader = localeLoaders[locale];
  if (!loader) return en;
  try {
    return await loader();
  } catch {
    return en;
  }
}

export const metadata: Metadata = {
  metadataBase: new URL('https://biocyclepeptides.com'),
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
  alternates: {
    canonical: 'https://biocyclepeptides.com',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BioCycle Peptides',
  },
  openGraph: {
    title: 'BioCycle Peptides - Premium Research Peptides',
    description: 'Canada\'s trusted source for premium research peptides. Lab-tested, 99%+ purity.',
    url: 'https://biocyclepeptides.com',
    siteName: 'BioCycle Peptides',
    locale: 'en_CA',
    type: 'website',
    images: [
      {
        url: 'https://biocyclepeptides.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'BioCycle Peptides - Premium Research Peptides Canada',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@biocyclepeptides',
    title: 'BioCycle Peptides - Premium Research Peptides',
    description: 'Canada\'s trusted source for premium research peptides. Lab-tested, 99%+ purity.',
    images: ['https://biocyclepeptides.com/opengraph-image'],
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
    logger.error('Error reading locale', { error: error instanceof Error ? error.message : String(error) });
    locale = defaultLocale;
  }
  
  // Get messages for the locale, fallback to English if not found
  const messages = await loadMessages(locale);
  const dir = localeDirections[locale] || 'ltr';
  
  return (
    <html lang={locale} dir={dir} data-locale={locale} suppressHydrationWarning>
      <head>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" content="#f97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BioCycle" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* hreflang for all 22 supported locales */}
        {locales.map((loc) => (
          <link key={loc} rel="alternate" hrefLang={loc} href={`https://biocyclepeptides.com?lang=${loc}`} />
        ))}
        <link rel="alternate" hrefLang="x-default" href="https://biocyclepeptides.com" />
        <Script id="sw-register" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }`}
        </Script>
      </head>
      <body className={inter.className}>
        <GoogleAnalytics />
        <MetaPixel />
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
        <Providers locale={locale} messages={messages}>
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
          <TranslationNotice />
          <TranslationFeedback />
        </Providers>
      </body>
    </html>
  );
}
