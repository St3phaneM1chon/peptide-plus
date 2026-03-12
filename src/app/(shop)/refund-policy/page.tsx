'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function RefundPolicyPage() {
  const { t } = useTranslations();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('legal.refund.title')}
          </h1>
          <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
            {t('legal.refund.subtitle')}
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">

          {/* Overview */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">📋</span>
              {t('legal.refund.policyOverviewTitle')}
            </h2>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-gray-700">
                {t('legal.refund.policyOverviewText')}
              </p>
            </div>
          </section>

          {/* Satisfaction Guarantee */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">✅</span>
              {t('legal.refund.qualityGuaranteeTitle')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                {t('legal.refund.qualityGuaranteeText')}
              </p>
              <ul className="space-y-2">
                <li>{t('legal.refund.qualityList1')}</li>
                <li>{t('legal.refund.qualityList2')}</li>
                <li>{t('legal.refund.qualityList3')}</li>
                <li>{t('legal.refund.qualityList4')}</li>
              </ul>
              <p className="mt-4">
                {t('legal.refund.qualityGuaranteeNote')}
              </p>
            </div>
          </section>

          {/* Eligible Returns */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">↩️</span>
              {t('legal.refund.eligibleReturnTitle')}
            </h2>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">{t('legal.refund.acceptReturnsTitle')}</h3>
                <ul className="text-green-700 space-y-1">
                  <li>{t('legal.refund.acceptList1')}</li>
                  <li>{t('legal.refund.acceptList2')}</li>
                  <li>{t('legal.refund.acceptList3')}</li>
                  <li>{t('legal.refund.acceptList4')}</li>
                  <li>{t('legal.refund.acceptList5')}</li>
                </ul>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">{t('legal.refund.cannotAcceptTitle')}</h3>
                <ul className="text-red-700 space-y-1">
                  <li>{t('legal.refund.cannotList1')}</li>
                  <li>{t('legal.refund.cannotList2')}</li>
                  <li>{t('legal.refund.cannotList3')}</li>
                  <li>{t('legal.refund.cannotList4')}</li>
                  <li>{t('legal.refund.cannotList5')}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How to Request */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">📝</span>
              {t('legal.refund.howToRequestTitle')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <ol className="space-y-4">
                <li>
                  <strong>{t('legal.refund.step1Title')}</strong>
                  <p>{t('legal.refund.step1Text')} <a href="mailto:support@biocyclepeptides.com" className="text-orange-600">support@biocyclepeptides.com</a> {t('legal.refund.step1With')}</p>
                  <ul>
                    <li>{t('legal.refund.step1Item1')}</li>
                    <li>{t('legal.refund.step1Item2')}</li>
                    <li>{t('legal.refund.step1Item3')}</li>
                  </ul>
                </li>
                <li>
                  <strong>{t('legal.refund.step2Title')}</strong>
                  <p>{t('legal.refund.step2Text')}</p>
                </li>
                <li>
                  <strong>{t('legal.refund.step3Title')}</strong>
                  <p>{t('legal.refund.step3Text')}</p>
                </li>
                <li>
                  <strong>{t('legal.refund.step4Title')}</strong>
                  <p>{t('legal.refund.step4Text')}</p>
                </li>
              </ol>
            </div>
          </section>

          {/* Refund Timeline */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">⏱️</span>
              {t('legal.refund.refundTimelineTitle')}
            </h2>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.refund.paymentMethod')}</th>
                    <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.refund.processingTime')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm">{t('legal.refund.creditDebit')}</td>
                    <td className="px-4 py-3 text-sm">{t('legal.refund.creditDebitTime')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm">{t('legal.refund.paypal')}</td>
                    <td className="px-4 py-3 text-sm">{t('legal.refund.paypalTime')}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm">{t('legal.refund.applePay')}</td>
                    <td className="px-4 py-3 text-sm">{t('legal.refund.applePayTime')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              * {t('legal.refund.timesVary')}
            </p>
          </section>

          {/* Damaged/Defective */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">⚠️</span>
              {t('legal.refund.damagedDefectiveTitle')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                {t('legal.refund.damagedDefectiveText')}
              </p>
              <ol className="space-y-2">
                <li>{t('legal.refund.damagedList1')}</li>
                <li>{t('legal.refund.damagedList2')}</li>
                <li>{t('legal.refund.damagedList3')}</li>
                <li>{t('legal.refund.damagedList4')}</li>
              </ol>
              <p className="mt-4">
                <strong>{t('legal.refund.damagedNoteLabel')}</strong> {t('legal.refund.damagedNoteText')}
              </p>
            </div>
          </section>

          {/* Cancellations */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">🚫</span>
              {t('legal.refund.orderCancellationsTitle')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <ul className="space-y-2">
                <li><strong>{t('legal.refund.cancelWithin1h')}</strong> {t('legal.refund.cancelWithin1hText')}</li>
                <li><strong>{t('legal.refund.cancelAfter1h')}</strong> {t('legal.refund.cancelAfter1hText')}</li>
                <li><strong>{t('legal.refund.cancelAfterShipping')}</strong> {t('legal.refund.cancelAfterShippingText')}</li>
              </ul>
            </div>
          </section>

          {/* Exchanges */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">🔄</span>
              {t('legal.refund.exchangesTitle')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                {t('legal.refund.exchangesText')}
              </p>
              <ol className="space-y-2">
                <li>{t('legal.refund.exchangeList1')}</li>
                <li>{t('legal.refund.exchangeList2')}</li>
                <li>{t('legal.refund.exchangeList3')}</li>
              </ol>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-orange-50 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('legal.refund.needHelp')}</h2>
            <p className="text-gray-600 mb-4">
              {t('legal.refund.needHelpText')}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                {t('legal.refund.contactSupport')}
              </Link>
              <a
                href="mailto:support@biocyclepeptides.com"
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                support@biocyclepeptides.com
              </a>
            </div>
          </section>

          {/* Last Updated */}
          <p className="text-sm text-gray-400 text-center pt-4">
            {t('legal.refund.lastUpdated')}: {t('legal.refund.lastUpdatedDate')}
          </p>

        </div>
      </div>
    </div>
  );
}
