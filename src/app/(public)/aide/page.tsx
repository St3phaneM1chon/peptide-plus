'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function HelpPage() {
  const { t } = useTranslations();

  const helpCategories = [
    { icon: '\uD83D\uDE80', titleKey: 'help.quickStartTitle', descKey: 'help.quickStartDesc', href: '/faq' },
    { icon: '\uD83D\uDC64', titleKey: 'help.myAccountTitle', descKey: 'help.myAccountDesc', href: '/faq' },
    { icon: '\uD83E\uDDEA', titleKey: 'help.productsTitle', descKey: 'help.productsDesc', href: '/faq' },
    { icon: '\uD83D\uDCB3', titleKey: 'help.paymentTitle', descKey: 'help.paymentDesc', href: '/faq' },
    { icon: '\uD83D\uDE9A', titleKey: 'help.shippingTitle', descKey: 'help.shippingDesc', href: '/shipping-policy' },
    { icon: '\uD83D\uDD27', titleKey: 'help.technicalTitle', descKey: 'help.technicalDesc', href: '/contact' },
  ];

  const popularArticleKeys = [
    'help.article1',
    'help.article2',
    'help.article3',
    'help.article4',
    'help.article5',
    'help.article6',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            {t('help.title')}
          </h1>
          <div className="max-w-lg mx-auto mt-6">
            <input
              type="search"
              placeholder={t('help.searchPlaceholder')}
              className="w-full px-6 py-4 rounded-lg border-none text-base text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {helpCategories.map((cat, i) => (
              <Link
                key={i}
                href={cat.href}
                className="bg-white rounded-xl p-8 flex gap-4 items-start hover:shadow-md hover:-translate-y-0.5 transition-all no-underline group"
              >
                <span className="text-3xl shrink-0">{cat.icon}</span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-orange-600 transition-colors">
                    {t(cat.titleKey)}
                  </h2>
                  <p className="text-sm text-gray-500">{t(cat.descKey)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            {t('help.popularArticlesTitle')}
          </h2>
          <div className="flex flex-col gap-3">
            {popularArticleKeys.map((key, i) => (
              <Link
                key={i}
                href="/faq"
                className="flex justify-between items-center px-5 py-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors no-underline"
              >
                <span className="text-base text-gray-700">{t(key)}</span>
                <span className="text-gray-400">&rarr;</span>
              </Link>
            ))}
          </div>
          <Link
            href="/faq"
            className="block text-center mt-6 text-orange-600 font-medium hover:text-orange-700 transition-colors"
          >
            {t('help.viewAllFaq')} &rarr;
          </Link>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            {t('help.needMoreHelp')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-8 text-center">
              <span className="text-4xl block mb-4">{'\uD83D\uDCAC'}</span>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('help.chatTitle')}</h3>
              <p className="text-sm text-gray-500 mb-4">{t('help.chatDesc')}</p>
              <button className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors">
                {t('help.openChat')}
              </button>
            </div>
            <div className="bg-white rounded-xl p-8 text-center">
              <span className="text-4xl block mb-4">{'\uD83D\uDCE7'}</span>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('help.emailTitle')}</h3>
              <p className="text-sm text-gray-500 mb-4">{t('help.emailDesc')}</p>
              <Link
                href="/contact"
                className="block w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-colors text-center"
              >
                {t('help.writeUs')}
              </Link>
            </div>
            <div className="bg-white rounded-xl p-8 text-center">
              <span className="text-4xl block mb-4">{'\uD83D\uDCDE'}</span>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('help.phoneTitle')}</h3>
              <p className="text-sm text-gray-500 mb-4">{t('help.phoneDesc')}</p>
              <a
                href="tel:1-855-999-7377"
                className="block w-full px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-colors text-center"
              >
                1-855-999-PEPP
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
