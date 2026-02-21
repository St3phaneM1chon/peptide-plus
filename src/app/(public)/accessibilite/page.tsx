'use client';

/**
 * PAGE ACCESSIBILITÉ
 * i18n: All text from legal.accessibility namespace
 */

import { useI18n } from '@/i18n/client';

export default function AccessibilityPage() {
  const { t } = useI18n();
  const lastUpdated = '2026-01-21';

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gray-900 text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="text-5xl block mb-6" role="img" aria-hidden="true">&#9855;</span>
          <h1 className="text-4xl font-bold mb-6">{t('legal.accessibility.title')}</h1>
          <p className="text-lg text-gray-300 leading-relaxed">
            {t('legal.accessibility.heroText')}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-8">
          <p className="text-sm text-gray-400 mb-8">
            {t('legal.lastUpdated', { date: lastUpdated })}
          </p>

          <div className="space-y-10 text-gray-600">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.accessibility.commitmentTitle')}</h2>
              <p>{t('legal.accessibility.commitmentText')}</p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.accessibility.complianceTitle')}</h2>
              <ul className="list-disc ps-6 space-y-2">
                <li><strong>WCAG 2.1 Level AA</strong> - {t('legal.accessibility.complianceList1').replace('WCAG 2.1 Level AA - ', '').replace('WCAG 2.1 niveau AA - ', '')}</li>
                <li><strong>Section 508</strong> - {t('legal.accessibility.complianceList2').replace('Section 508 - ', '')}</li>
                <li><strong>EN 301 549</strong> - {t('legal.accessibility.complianceList3').replace('EN 301 549 - ', '').replace('EN 301 549 - ', '')}</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.accessibility.measuresTitle')}</h2>
              <ul className="list-disc ps-6 space-y-2">
                <li>{t('legal.accessibility.measuresList1')}</li>
                <li>{t('legal.accessibility.measuresList2')}</li>
                <li>{t('legal.accessibility.measuresList3')}</li>
                <li>{t('legal.accessibility.measuresList4')}</li>
                <li>{t('legal.accessibility.measuresList5')}</li>
                <li>{t('legal.accessibility.measuresList6')}</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('legal.accessibility.contactTitle')}</h2>
              <p>
                {t('legal.accessibility.contactText')}{' '}
                <a href="mailto:support@biocyclepeptides.com" className="text-blue-600 hover:underline">
                  support@biocyclepeptides.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
