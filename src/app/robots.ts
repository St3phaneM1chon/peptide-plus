/**
 * ROBOTS.TXT - Search engine crawling rules
 */

import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/dashboard/', '/auth/', '/checkout/', '/account/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
