/**
 * ROBOTS.TXT - Search engine crawling rules
 *
 * Strategy:
 * - Allow all public/marketing pages for maximum SEO coverage
 * - Block private areas (admin, API, auth, account, checkout, dashboards)
 * - Explicitly welcome major search engine bots
 * - Reference sitemap for discovery
 */

import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

  return {
    rules: [
      // Googlebot — full access to public pages
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/platform/',
          '/a-propos/',
          '/blog/',
          '/shop',
          '/learn/',
          '/solutions/',
          '/clients/',
          '/ressources/',
          '/tarifs',
          '/pricing',
          '/faq',
          '/contact',
          '/community',
          '/bundles/',
          '/catalogue',
          '/videos',
          '/webinars',
          '/changelog',
          '/status',
        ],
        disallow: [
          '/admin/',
          '/api/',
          '/auth/',
          '/dashboard/',
          '/account/',
          '/checkout/',
          '/client/',
          '/owner/',
          '/mobile/',
          '/consent/',
          '/onboarding/',
          '/verify/',
          '/change-password/',
          '/email-preferences/',
          '/portal/',
          '/estimate/',
        ],
      },
      // Bingbot — same rules as Googlebot
      {
        userAgent: 'Bingbot',
        allow: [
          '/',
          '/platform/',
          '/a-propos/',
          '/blog/',
          '/shop',
          '/learn/',
          '/solutions/',
          '/clients/',
          '/ressources/',
          '/tarifs',
          '/pricing',
          '/faq',
          '/contact',
          '/community',
          '/bundles/',
          '/catalogue',
          '/videos',
          '/webinars',
        ],
        disallow: [
          '/admin/',
          '/api/',
          '/auth/',
          '/dashboard/',
          '/account/',
          '/checkout/',
          '/client/',
          '/owner/',
          '/mobile/',
          '/consent/',
          '/onboarding/',
          '/verify/',
          '/change-password/',
          '/email-preferences/',
          '/portal/',
          '/estimate/',
        ],
      },
      // All other bots — general rules
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/auth/',
          '/dashboard/',
          '/account/',
          '/checkout/',
          '/client/',
          '/owner/',
          '/mobile/',
          '/consent/',
          '/onboarding/',
          '/verify/',
          '/change-password/',
          '/email-preferences/',
          '/portal/',
          '/estimate/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
