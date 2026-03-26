'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function EquipePage() {
  const { t } = useTranslations();

  const departments = [
    { icon: '\uD83D\uDD2C', titleKey: 'about.team.scientificTitle', descKey: 'about.team.scientificDesc', borderColor: 'border-emerald-500' },
    { icon: '\uD83D\uDCE6', titleKey: 'about.team.logisticsTitle', descKey: 'about.team.logisticsDesc', borderColor: 'border-blue-500' },
    { icon: '\uD83D\uDCAC', titleKey: 'about.team.supportTitle', descKey: 'about.team.supportDesc', borderColor: 'border-primary-500' },
    { icon: '\uD83D\uDCBB', titleKey: 'about.team.techTitle', descKey: 'about.team.techDesc', borderColor: 'border-violet-500' },
  ];

  const unitValues = [
    { icon: '\uD83C\uDFAF', key: 'about.team.precision' },
    { icon: '\uD83E\uDD1D', key: 'about.team.collaboration' },
    { icon: '\uD83D\uDCA1', key: 'about.team.innovation' },
    { icon: '\u2764\uFE0F', key: 'about.team.passion' },
    { icon: '\uD83D\uDD12', key: 'about.team.integrity' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-blue-500 text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <Link href="/a-propos" className="text-white/80 hover:text-white text-sm transition-colors">
            &larr; {t('about.backToAbout')}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold font-heading mt-6 mb-6">
            {t('about.team.title')}
          </h1>
          <p className="text-xl leading-relaxed text-blue-100">
            {t('about.team.subtitle')}
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Introduction */}
        <section className="mb-12 text-center">
          <p className="text-lg leading-relaxed text-gray-600 max-w-3xl mx-auto">
            {t('about.team.introText')}
          </p>
        </section>

        {/* Departments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {departments.map((dept, index) => (
            <div
              key={index}
              className={`p-8 bg-gray-50 rounded-2xl border-s-4 ${dept.borderColor}`}
            >
              <div className="text-4xl mb-4">{dept.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t(dept.titleKey)}
              </h3>
              <p className="text-sm leading-relaxed text-gray-500">
                {t(dept.descKey)}
              </p>
            </div>
          ))}
        </div>

        {/* What Unites Us */}
        <section className="p-10 bg-gray-50 rounded-2xl text-center mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            {t('about.team.unitsUsTitle')}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {unitValues.map((val, index) => (
              <span
                key={index}
                className="flex items-center gap-2 px-5 py-3 bg-white rounded-full border border-gray-200"
              >
                <span>{val.icon}</span>
                <span className="font-medium text-gray-700">{t(val.key)}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Join Us */}
        <section className="p-10 bg-gray-800 rounded-2xl text-center text-white">
          <h2 className="text-2xl font-semibold mb-4">
            {t('about.team.joinTitle')}
          </h2>
          <p className="text-gray-400 mb-6 max-w-xl mx-auto">
            {t('about.team.joinText')}
          </p>
          <a
            href="mailto:careers@koraline.com"
            className="inline-block px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
          >
            careers@koraline.com
          </a>
        </section>
      </div>
    </div>
  );
}
