'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function EngagementsPage() {
  const { t } = useTranslations();

  const engagements = [
    {
      icon: '\uD83C\uDFC6',
      titleKey: 'about.engagements.qualityTitle',
      itemPrefix: 'about.engagements.qualityItems',
      count: 5,
      color: 'text-primary-600',
      bg: 'bg-primary-50',
    },
    {
      icon: '\u26A1',
      titleKey: 'about.engagements.serviceTitle',
      itemPrefix: 'about.engagements.serviceItems',
      count: 5,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: '\uD83D\uDC41\uFE0F',
      titleKey: 'about.engagements.transparencyTitle',
      itemPrefix: 'about.engagements.transparencyItems',
      count: 5,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      icon: '\uD83C\uDF31',
      titleKey: 'about.engagements.environmentTitle',
      itemPrefix: 'about.engagements.environmentItems',
      count: 5,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: '\u2696\uFE0F',
      titleKey: 'about.engagements.ethicsTitle',
      itemPrefix: 'about.engagements.ethicsItems',
      count: 5,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-emerald-500 text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <Link href="/a-propos" className="text-white/80 hover:text-white text-sm transition-colors">
            &larr; {t('about.backToAbout')}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold font-heading mt-6 mb-6">
            {t('about.engagements.title')}
          </h1>
          <p className="text-xl leading-relaxed text-emerald-100">
            {t('about.engagements.subtitle')}
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        {engagements.map((eng, idx) => (
          <section key={idx} className="mb-12">
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-12 h-12 ${eng.bg} rounded-xl flex items-center justify-center text-2xl`}>
                {eng.icon}
              </div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {t(eng.titleKey)}
              </h2>
            </div>
            <ul className="space-y-3 ps-6">
              {Array.from({ length: eng.count }, (_, i) => (
                <li key={i} className="relative ps-6 text-base leading-relaxed text-gray-600">
                  <span className={`absolute start-0 font-bold ${eng.color}`}>{'\u2713'}</span>
                  {t(`${eng.itemPrefix}${i + 1}`)}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* CTA */}
        <div className="mt-16 p-10 bg-gray-800 rounded-2xl text-center text-white">
          <h3 className="text-2xl font-semibold mb-4">
            {t('about.engagements.ctaTitle')}
          </h3>
          <p className="text-gray-400 mb-6">
            {t('about.engagements.ctaText')}
          </p>
          <Link
            href="/contact"
            className="inline-block px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
          >
            {t('about.engagements.ctaButton')} &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
