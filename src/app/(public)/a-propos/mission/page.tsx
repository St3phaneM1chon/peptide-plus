'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function MissionPage() {
  const { t } = useTranslations();

  const objectives = [
    { number: '01', titleKey: 'about.mission.obj1Title', descKey: 'about.mission.obj1Desc' },
    { number: '02', titleKey: 'about.mission.obj2Title', descKey: 'about.mission.obj2Desc' },
    { number: '03', titleKey: 'about.mission.obj3Title', descKey: 'about.mission.obj3Desc' },
    { number: '04', titleKey: 'about.mission.obj4Title', descKey: 'about.mission.obj4Desc' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-primary-600 text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <Link href="/a-propos" className="text-white/80 hover:text-white text-sm transition-colors">
            &larr; {t('about.backToAbout')}
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold font-heading mt-6 mb-6">
            {t('about.mission.title')}
          </h1>
          <p className="text-xl leading-relaxed text-primary-100">
            {t('about.mission.subtitle')}
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6">
            {t('about.mission.whyTitle')}
          </h2>
          <p className="text-base leading-relaxed text-gray-600 mb-4">
            {t('about.mission.whyText1')}
          </p>
          <p className="text-base leading-relaxed text-gray-600">
            {t('about.mission.whyText2')}
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-6">
            {t('about.mission.objectivesTitle')}
          </h2>
          <div className="flex flex-col gap-5">
            {objectives.map((obj) => (
              <div key={obj.number} className="flex gap-5 p-6 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                  {obj.number}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {t(obj.titleKey)}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-500">
                    {t(obj.descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-8 bg-amber-50 rounded-xl border border-amber-300">
          <h3 className="text-lg font-semibold text-amber-800 mb-3">
            {t('about.mission.disclaimerTitle')}
          </h3>
          <p className="text-sm leading-relaxed text-amber-800">
            {t('about.mission.disclaimerText')}
          </p>
        </section>
      </div>
    </div>
  );
}
