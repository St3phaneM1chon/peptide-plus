'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function ShippingPolicyPage() {
  const { t } = useTranslations();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('legal.shipping.title')}
          </h1>
          <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
            {t('legal.shipping.subtitle')}
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">

          {/* Processing Time */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">📦</span>
              {t('legal.shipping.processing.title')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <ul className="space-y-2">
                <li>{t('legal.shipping.processing.item1')}</li>
                <li>{t('legal.shipping.processing.item2')}</li>
                <li>{t('legal.shipping.processing.item3')}</li>
                <li>{t('legal.shipping.processing.item4')}</li>
              </ul>
            </div>
          </section>

          {/* Shipping Options */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">🚚</span>
              {t('legal.shipping.options.title')}
            </h2>

            {/* Canada */}
            <div className="mb-6">
              <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2">
                🇨🇦 {t('legal.shipping.options.canada')}
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.shipping.options.method')}</th>
                      <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.shipping.options.deliveryTime')}</th>
                      <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.shipping.options.cost')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.canadaPostXpresspost')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.oneToThreeDays')}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">{t('legal.shipping.options.freeOver150')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.canadaPostXpresspost')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.oneToThreeDays')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.under150')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.priority')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.nextBusinessDay')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.priorityCost')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* USA */}
            <div className="mb-6">
              <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2">
                🇺🇸 {t('legal.shipping.options.unitedStates')}
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.shipping.options.method')}</th>
                      <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.shipping.options.deliveryTime')}</th>
                      <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.shipping.options.cost')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.standardInternational')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.fiveToSevenDays')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.standardUSCost')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.expressInternational')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.threeToFiveDays')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.expressUSCost')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* International */}
            <div>
              <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2">
                🌍 {t('legal.shipping.options.international')}
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.shipping.options.region')}</th>
                      <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.shipping.options.deliveryTime')}</th>
                      <th className="px-4 py-3 text-start text-sm font-semibold text-gray-700">{t('legal.shipping.options.cost')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.europe')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.sevenToFourteenDays')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.europeCost')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.australia')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.tenToFourteenDays')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.australiaCost')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.asia')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.tenToFourteenDays')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.asiaCost')}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.restOfWorld')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.fourteenToTwentyOneDays')}</td>
                      <td className="px-4 py-3 text-sm">{t('legal.shipping.options.calculatedAtCheckout')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Packaging */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">📋</span>
              {t('legal.shipping.packaging.title')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <ul className="space-y-2">
                <li>{t('legal.shipping.packaging.item1')}</li>
                <li>{t('legal.shipping.packaging.item2')}</li>
                <li>{t('legal.shipping.packaging.item3')}</li>
                <li>{t('legal.shipping.packaging.item4')}</li>
              </ul>
            </div>
          </section>

          {/* Tracking */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">📍</span>
              {t('legal.shipping.tracking.title')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>{t('legal.shipping.tracking.intro')}</p>
              <ul className="space-y-2">
                <li>{t('legal.shipping.tracking.item1')}</li>
                <li>{t('legal.shipping.tracking.item2')}</li>
                <li>{t('legal.shipping.tracking.item3')}</li>
              </ul>
              <p className="mt-4">
                <Link href="/track-order" className="text-orange-600 hover:underline font-medium">
                  {t('legal.shipping.tracking.trackOrderLink')}
                </Link>
              </p>
            </div>
          </section>

          {/* Customs */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">🛃</span>
              {t('legal.shipping.customs.title')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>{t('legal.shipping.customs.intro')}</p>
              <ul className="space-y-2">
                <li>{t('legal.shipping.customs.item1')}</li>
                <li>{t('legal.shipping.customs.item2')}</li>
                <li>{t('legal.shipping.customs.item3')}</li>
                <li>{t('legal.shipping.customs.item4')}</li>
              </ul>
            </div>
          </section>

          {/* Lost/Damaged */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">⚠️</span>
              {t('legal.shipping.lostDamaged.title')}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>{t('legal.shipping.lostDamaged.intro')}</p>
              <ul className="space-y-2">
                <li>{t('legal.shipping.lostDamaged.item1')}</li>
                <li>{t('legal.shipping.lostDamaged.item2')}</li>
                <li>{t('legal.shipping.lostDamaged.item3')}</li>
              </ul>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-orange-50 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('legal.shipping.contact.title')}</h2>
            <p className="text-gray-600 mb-4">
              {t('legal.shipping.contact.description')}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                {t('legal.shipping.contact.contactSupport')}
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('legal.shipping.contact.viewFaq')}
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
