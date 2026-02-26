import Link from 'next/link';
import { createServerTranslator, type Locale } from '@/i18n/server';
import { defaultLocale } from '@/i18n/config';

/**
 * Safely get the server locale, falling back to defaultLocale if cookies()
 * is not available (e.g. during static page data collection in next build).
 */
async function getSafeLocale(): Promise<Locale> {
  try {
    // Dynamic import to avoid top-level cookies() call that crashes during static generation
    const { getServerLocale } = await import('@/i18n/server');
    return await getServerLocale();
  } catch {
    return defaultLocale;
  }
}

export default async function NotFound() {
  const locale = await getSafeLocale();
  const t = createServerTranslator(locale);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔍</span>
          </div>
          <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">{t('errors.pageNotFound')}</h2>
          <p className="text-gray-600 mb-6">
            {t('errors.pageNotFoundDesc')}
          </p>
        </div>
        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            {t('errors.goToHomepage')}
          </Link>
          <Link
            href="/shop"
            className="block w-full px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('errors.browseProducts')}
          </Link>
        </div>
      </div>
    </div>
  );
}
