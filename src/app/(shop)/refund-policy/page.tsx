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
            {t('refund.title') || 'Refund & Return Policy'}
          </h1>
          <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
            {t('refund.subtitle') || 'Your satisfaction is our priority. Learn about our fair and transparent policies.'}
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">
          
          {/* Overview */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">📋</span>
              Policy Overview
            </h2>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-gray-700">
                Due to the sensitive nature of research peptides and strict quality control requirements, 
                we have specific guidelines for returns and refunds. Please read this policy carefully before placing your order.
              </p>
            </div>
          </section>

          {/* Satisfaction Guarantee */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">✅</span>
              Quality Guarantee
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                We stand behind the quality of our products. Every peptide is:
              </p>
              <ul className="space-y-2">
                <li>Manufactured in cGMP-compliant facilities</li>
                <li>Third-party tested for purity (99%+)</li>
                <li>Accompanied by a Certificate of Analysis (COA)</li>
                <li>Shipped in proper conditions to maintain integrity</li>
              </ul>
              <p className="mt-4">
                If any product does not meet our quality standards, we will <strong>replace it free of charge</strong> or provide a <strong>full refund</strong>.
              </p>
            </div>
          </section>

          {/* Eligible Returns */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">↩️</span>
              Eligible for Return/Refund
            </h2>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">✓ We Accept Returns/Refunds For:</h3>
                <ul className="text-green-700 space-y-1">
                  <li>• Unopened, sealed products within 30 days of delivery</li>
                  <li>• Damaged products (with photo evidence)</li>
                  <li>• Products that do not match the description/COA</li>
                  <li>• Wrong items shipped</li>
                  <li>• Lost packages (confirmed by carrier)</li>
                </ul>
              </div>
              
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">✗ We Cannot Accept Returns For:</h3>
                <ul className="text-red-700 space-y-1">
                  <li>• Opened or reconstituted products</li>
                  <li>• Products stored improperly by the customer</li>
                  <li>• Products returned after 30 days</li>
                  <li>• Change of mind (without product defect)</li>
                  <li>• International orders refused at customs (customer responsibility)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How to Request */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">📝</span>
              How to Request a Refund
            </h2>
            <div className="prose prose-gray max-w-none">
              <ol className="space-y-4">
                <li>
                  <strong>Step 1: Contact Us</strong>
                  <p>Email us at <a href="mailto:support@biocyclepeptides.com" className="text-orange-600">support@biocyclepeptides.com</a> with:</p>
                  <ul>
                    <li>Your order number</li>
                    <li>Reason for the return/refund request</li>
                    <li>Photos of the product/damage (if applicable)</li>
                  </ul>
                </li>
                <li>
                  <strong>Step 2: Await Approval</strong>
                  <p>Our team will review your request within 1-2 business days and respond with instructions.</p>
                </li>
                <li>
                  <strong>Step 3: Return Shipping (if required)</strong>
                  <p>For unopened product returns, we will provide a return shipping label. Ship items in their original packaging.</p>
                </li>
                <li>
                  <strong>Step 4: Receive Refund</strong>
                  <p>Once we receive and inspect the return, refunds are processed within 5-7 business days to your original payment method.</p>
                </li>
              </ol>
            </div>
          </section>

          {/* Refund Timeline */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">⏱️</span>
              Refund Timeline
            </h2>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Payment Method</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Processing Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm">Credit/Debit Card</td>
                    <td className="px-4 py-3 text-sm">5-7 business days</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm">PayPal</td>
                    <td className="px-4 py-3 text-sm">3-5 business days</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm">Apple Pay / Google Pay</td>
                    <td className="px-4 py-3 text-sm">5-7 business days</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              * Times may vary depending on your bank or financial institution.
            </p>
          </section>

          {/* Damaged/Defective */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">⚠️</span>
              Damaged or Defective Products
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                If you receive a damaged or defective product:
              </p>
              <ol className="space-y-2">
                <li>Do NOT use or open the product</li>
                <li>Take clear photos of the damage (packaging and product)</li>
                <li>Contact us within 48 hours of delivery</li>
                <li>We will send a replacement immediately at no cost</li>
              </ol>
              <p className="mt-4">
                <strong>Note:</strong> You do not need to return damaged products in most cases. 
                We trust our customers and prioritize quick resolution.
              </p>
            </div>
          </section>

          {/* Cancellations */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">🚫</span>
              Order Cancellations
            </h2>
            <div className="prose prose-gray max-w-none">
              <ul className="space-y-2">
                <li><strong>Within 1 hour:</strong> Orders can be cancelled with a full refund.</li>
                <li><strong>After 1 hour:</strong> Orders may have already entered processing and cannot be cancelled. Contact us to check status.</li>
                <li><strong>After shipping:</strong> Orders cannot be cancelled once shipped. You may refuse delivery or request a return once received.</li>
              </ul>
            </div>
          </section>

          {/* Exchanges */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <span className="text-orange-500">🔄</span>
              Exchanges
            </h2>
            <div className="prose prose-gray max-w-none">
              <p>
                We do not offer direct exchanges. If you need a different product:
              </p>
              <ol className="space-y-2">
                <li>Return the original item (if eligible)</li>
                <li>Place a new order for the desired product</li>
                <li>We can expedite shipping on the new order upon request</li>
              </ol>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-orange-50 rounded-xl p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Need Help?</h2>
            <p className="text-gray-600 mb-4">
              Our customer support team is here to assist with any return or refund questions.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                Contact Support
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
            Last updated: January 2026
          </p>

        </div>
      </div>
    </div>
  );
}
