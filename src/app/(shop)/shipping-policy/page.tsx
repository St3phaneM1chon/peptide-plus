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
            {t('shipping.title') || 'Shipping Policy'}
          </h1>
          <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
            {t('shipping.subtitle') || 'Fast, secure, and discreet delivery for your research needs.'}
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">
          
          {/* Processing Time */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">📦</span>
              {t('shipping.processing.title') || 'Order Processing'}
            </h2>
            <div className="prose prose-gray max-w-none">
              <ul className="space-y-2">
                <li>Orders placed before <strong>2:00 PM EST</strong> are processed and shipped the <strong>same business day</strong>.</li>
                <li>Orders placed after 2:00 PM EST will be processed the next business day.</li>
                <li>Orders placed on weekends or holidays will be processed the next business day.</li>
                <li>You will receive a confirmation email with tracking information once your order ships.</li>
              </ul>
            </div>
          </section>

          {/* Shipping Options */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">🚚</span>
              {t('shipping.options.title') || 'Shipping Options & Delivery Times'}
            </h2>
            
            {/* Canada */}
            <div className="mb-6">
              <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2">
                🇨🇦 Canada
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Method</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Delivery Time</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm">Canada Post Xpresspost</td>
                      <td className="px-4 py-3 text-sm">1-3 business days</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">FREE over $150</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">Canada Post Xpresspost</td>
                      <td className="px-4 py-3 text-sm">1-3 business days</td>
                      <td className="px-4 py-3 text-sm">$15.00 (under $150)</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">Priority</td>
                      <td className="px-4 py-3 text-sm">Next business day</td>
                      <td className="px-4 py-3 text-sm">$25.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* USA */}
            <div className="mb-6">
              <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2">
                🇺🇸 United States
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Method</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Delivery Time</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm">Standard International</td>
                      <td className="px-4 py-3 text-sm">5-7 business days</td>
                      <td className="px-4 py-3 text-sm">$25.00 USD</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">Express International</td>
                      <td className="px-4 py-3 text-sm">3-5 business days</td>
                      <td className="px-4 py-3 text-sm">$40.00 USD</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* International */}
            <div>
              <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2">
                🌍 International
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Region</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Delivery Time</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm">Europe (EU, UK)</td>
                      <td className="px-4 py-3 text-sm">7-14 business days</td>
                      <td className="px-4 py-3 text-sm">$35.00 - $50.00</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">Australia / New Zealand</td>
                      <td className="px-4 py-3 text-sm">10-14 business days</td>
                      <td className="px-4 py-3 text-sm">$40.00 - $55.00</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">Asia</td>
                      <td className="px-4 py-3 text-sm">10-14 business days</td>
                      <td className="px-4 py-3 text-sm">$45.00 - $60.00</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm">Rest of World</td>
                      <td className="px-4 py-3 text-sm">14-21 business days</td>
                      <td className="px-4 py-3 text-sm">Calculated at checkout</td>
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
              {t('shipping.packaging.title') || 'Packaging & Handling'}
            </h2>
            <div className="prose prose-gray max-w-none">
              <ul className="space-y-2">
                <li><strong>Temperature-controlled packaging:</strong> All orders include cold packs during warmer months to maintain product integrity.</li>
                <li><strong>Discreet packaging:</strong> Packages are plain with no external labeling indicating the contents.</li>
                <li><strong>Protective packaging:</strong> Vials are individually wrapped and secured with protective padding.</li>
                <li><strong>Vacuum-sealed vials:</strong> All peptides are shipped in sealed vials to ensure sterility.</li>
              </ul>
            </div>
          </section>

          {/* Tracking */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">📍</span>
              {t('shipping.tracking.title') || 'Order Tracking'}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>All orders include tracking information. You will receive:</p>
              <ul className="space-y-2">
                <li>An order confirmation email immediately after purchase</li>
                <li>A shipping confirmation email with tracking number when your order ships</li>
                <li>Ability to track your order through our website or the carrier's website</li>
              </ul>
              <p className="mt-4">
                <Link href="/track-order" className="text-orange-600 hover:underline font-medium">
                  Track your order here →
                </Link>
              </p>
            </div>
          </section>

          {/* Customs */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">🛃</span>
              {t('shipping.customs.title') || 'Customs & Import Duties'}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>For international orders:</p>
              <ul className="space-y-2">
                <li>Customers are responsible for any customs duties, import taxes, or fees imposed by their country.</li>
                <li>We declare accurate values on customs forms as required by law.</li>
                <li>Peptide Plus+ is not responsible for delays caused by customs clearance.</li>
                <li>If an order is refused or returned due to customs issues, the customer is responsible for return shipping costs.</li>
              </ul>
            </div>
          </section>

          {/* Lost/Damaged */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">⚠️</span>
              {t('shipping.lostDamaged.title') || 'Lost or Damaged Packages'}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>All shipments are fully insured. If your package is:</p>
              <ul className="space-y-2">
                <li><strong>Lost:</strong> Contact us after the estimated delivery date has passed. We will file a claim and either reship your order or provide a full refund.</li>
                <li><strong>Damaged:</strong> Take photos of the damage (outer packaging and products) and contact us within 48 hours. We will replace the items at no cost.</li>
                <li><strong>Compromised:</strong> If vials appear opened, contaminated, or otherwise compromised, do not use them. Contact us immediately for a replacement.</li>
              </ul>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-orange-50 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Questions About Shipping?</h2>
            <p className="text-gray-600 mb-4">
              Our team is available to help with any shipping-related questions.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Contact Support
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                View FAQ
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
