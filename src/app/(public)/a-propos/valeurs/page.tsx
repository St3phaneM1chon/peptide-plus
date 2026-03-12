'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function ValeursPage() {
  const { t } = useTranslations();

  const values = [
    { icon: '\uD83D\uDD2C', titleKey: 'about.values.scientificRigorTitle', descKey: 'about.values.scientificRigorDesc', borderColor: 'border-blue-500' },
    { icon: '\uD83E\uDD1D', titleKey: 'about.values.integrityTitle', descKey: 'about.values.integrityDesc', borderColor: 'border-emerald-500' },
    { icon: '\uD83D\uDCA1', titleKey: 'about.values.innovationTitle', descKey: 'about.values.innovationDesc', borderColor: 'border-amber-500' },
    { icon: '\uD83C\uDF0D', titleKey: 'about.values.responsibilityTitle', descKey: 'about.values.responsibilityDesc', borderColor: 'border-violet-500' },
    { icon: '\u26A1', titleKey: 'about.values.serviceTitle', descKey: 'about.values.serviceDesc', borderColor: 'border-red-500' },
    { icon: '\uD83D\uDCDA', titleKey: 'about.values.educationTitle', descKey: 'about.values.educationDesc', borderColor: 'border-cyan-500' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-violet-500 to-violet-700 text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <Link href="/a-propos" className="text-white/80 hover:text-white text-sm transition-colors">
            &larr; {t('about.backToAbout')}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mt-6 mb-6">
            {t('about.values.title')}
          </h1>
          <p className="text-xl leading-relaxed text-violet-100">
            {t('about.values.subtitle')}
          </p>
        </div>
      </section>

      {/* Values Grid */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <div
              key={index}
              className={`p-8 bg-gray-50 rounded-2xl border-t-4 ${value.borderColor}`}
            >
              <div className="text-4xl mb-5">{value.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {t(value.titleKey)}
              </h3>
              <p className="text-sm leading-relaxed text-gray-500">
                {t(value.descKey)}
              </p>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div className="mt-16 p-10 bg-gray-800 rounded-2xl text-center text-white">
          <p className="text-2xl italic leading-relaxed mb-4">
            &ldquo;{t('about.values.quoteText')}&rdquo;
          </p>
          <p className="text-sm text-gray-400">
            &mdash; {t('about.values.quoteAuthor')}
          </p>
        </div>
      </div>
    </div>
  );
}
