'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function HistoirePage() {
  const { t } = useTranslations();

  const timeline = [
    {
      year: '2023',
      titleKey: 'about.history.year2023Title',
      descKey: 'about.history.year2023Desc',
      color: 'bg-orange-600',
      ring: 'ring-orange-600',
      badge: 'bg-orange-600',
    },
    {
      year: '2024',
      titleKey: 'about.history.year2024Title',
      descKey: 'about.history.year2024Desc',
      color: 'bg-blue-500',
      ring: 'ring-blue-500',
      badge: 'bg-blue-500',
    },
    {
      year: '2025',
      titleKey: 'about.history.year2025Title',
      descKey: 'about.history.year2025Desc',
      color: 'bg-emerald-500',
      ring: 'ring-emerald-500',
      badge: 'bg-emerald-500',
    },
    {
      year: '2026',
      titleKey: 'about.history.year2026Title',
      descKey: 'about.history.year2026Desc',
      color: 'bg-violet-500',
      ring: 'ring-violet-500',
      badge: 'bg-violet-500',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <Link href="/a-propos" className="text-white/80 hover:text-white text-sm transition-colors">
            &larr; {t('about.backToAbout')}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mt-6 mb-6">
            {t('about.history.title')}
          </h1>
          <p className="text-xl leading-relaxed text-gray-300">
            {t('about.history.subtitle')}
          </p>
        </div>
      </section>

      {/* Timeline */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute start-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          {timeline.map((item, index) => (
            <div
              key={item.year}
              className={`relative ps-[72px] ${index < timeline.length - 1 ? 'pb-12' : ''}`}
            >
              {/* Dot */}
              <div
                className={`absolute start-3 top-1 w-6 h-6 rounded-full ${item.color} border-4 border-white ring-2 ${item.ring}`}
              />

              {/* Year badge */}
              <span className={`inline-block px-3 py-1 ${item.badge} text-white rounded-full text-sm font-semibold mb-3`}>
                {item.year}
              </span>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {t(item.titleKey)}
              </h3>
              <p className="text-base leading-relaxed text-gray-500">
                {t(item.descKey)}
              </p>
            </div>
          ))}
        </div>

        {/* Future */}
        <div className="mt-16 p-8 bg-green-50 rounded-2xl border border-green-300 text-center">
          <h3 className="text-xl font-semibold text-green-800 mb-3">
            {t('about.history.futureTitle')}
          </h3>
          <p className="text-base leading-relaxed text-green-700">
            {t('about.history.futureText')}
          </p>
        </div>
      </div>
    </div>
  );
}
