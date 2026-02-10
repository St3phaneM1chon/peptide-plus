'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

// FAQ Categories for Peptide Plus+
const faqCategories = [
  {
    name: 'About Peptides',
    nameKey: 'faq.category.aboutPeptides',
    icon: '🔬',
    questions: [
      {
        q: 'What are research peptides?',
        qKey: 'faq.q1',
        a: 'Peptides are short chains of amino acids (typically 2-50 amino acids) that serve as building blocks for proteins. Research peptides are synthesized versions of naturally occurring peptides used exclusively for laboratory and scientific research purposes. They are NOT approved for human consumption and should only be used by qualified researchers in appropriate settings.',
        aKey: 'faq.a1',
      },
      {
        q: 'What is the purity of your peptides?',
        qKey: 'faq.q2',
        a: 'All Peptide Plus+ products undergo rigorous testing and maintain a purity level of 99% or higher. Each batch is tested using High-Performance Liquid Chromatography (HPLC) and Mass Spectrometry (MS) to verify purity, identity, and quality. Certificates of Analysis (COA) are available for every product.',
        aKey: 'faq.a2',
      },
      {
        q: 'Are your peptides tested?',
        qKey: 'faq.q3',
        a: 'Yes, every batch of our peptides undergoes comprehensive third-party laboratory testing including: HPLC (High-Performance Liquid Chromatography) for purity analysis, Mass Spectrometry for molecular identification, and sterility testing. COA documents are available on each product page.',
        aKey: 'faq.a3',
      },
      {
        q: 'What does "for research purposes only" mean?',
        qKey: 'faq.q4',
        a: 'This means our products are sold exclusively for legitimate scientific and laboratory research. They are not intended for human or animal consumption, medical treatment, diagnosis, or any form of personal use. Purchasers must be qualified researchers or represent accredited research institutions.',
        aKey: 'faq.a4',
      },
    ],
  },
  {
    name: 'Reconstitution & Storage',
    nameKey: 'faq.category.reconstitution',
    icon: '💉',
    questions: [
      {
        q: 'How do I reconstitute peptides?',
        qKey: 'faq.q5',
        a: `To reconstitute peptides properly:
1. Allow the vial to reach room temperature
2. Use Bacteriostatic Water (BAC Water) as the solvent
3. Insert the needle through the rubber stopper
4. Slowly inject the water along the inside wall of the vial (NOT directly onto the powder)
5. Do NOT shake - gently swirl or let it sit until fully dissolved
6. Store reconstituted peptides in the refrigerator (2-8°C)

Never use regular water or saline unless specifically indicated for your research protocol.`,
        aKey: 'faq.a5',
      },
      {
        q: 'How much bacteriostatic water should I use?',
        qKey: 'faq.q6',
        a: `The amount depends on your research requirements. Here's a general formula:

• Step 1: Convert peptide amount to mcg (e.g., 10mg = 10,000mcg)
• Step 2: Divide by your desired concentration
• Example: 10,000mcg ÷ 250mcg/0.1ml = 40 doses of 0.1ml

Common reconstitution volumes:
- 5mg vial: 1-2ml BAC water
- 10mg vial: 2ml BAC water
- For easier math, 2ml in a 10mg vial = 5mg/ml = 500mcg per 0.1ml (10 units on insulin syringe)`,
        aKey: 'faq.a6',
      },
      {
        q: 'How should I store peptides?',
        qKey: 'faq.q7',
        a: `Storage guidelines:

**Lyophilized (powder) peptides:**
- Store at -20°C for long-term storage (up to 24 months)
- Can be stored at 2-8°C (refrigerator) for shorter periods
- Keep away from light and moisture
- Keep in original sealed vial

**Reconstituted peptides:**
- Store at 2-8°C (refrigerator) - NEVER freeze
- Most peptides are stable for 14-30 days after reconstitution
- Protect from light (wrap in foil if needed)
- Do not contaminate the rubber stopper`,
        aKey: 'faq.a7',
      },
      {
        q: 'What is bacteriostatic water?',
        qKey: 'faq.q8',
        a: 'Bacteriostatic Water (BAC Water) is sterile water containing 0.9% benzyl alcohol as a preservative. The benzyl alcohol prevents bacterial growth, making it safe for multiple uses over an extended period. This is the recommended solvent for reconstituting most research peptides. We offer pharmaceutical-grade BAC water in our accessories section.',
        aKey: 'faq.a8',
      },
    ],
  },
  {
    name: 'Ordering & Payment',
    nameKey: 'faq.category.ordering',
    icon: '🛒',
    questions: [
      {
        q: 'What payment methods do you accept?',
        qKey: 'faq.q9',
        a: 'We accept: Credit/Debit Cards (Visa, Mastercard, American Express), PayPal, Apple Pay, Google Pay, and Shop Pay for faster checkout. All transactions are processed securely with SSL encryption.',
        aKey: 'faq.a9',
      },
      {
        q: 'Is my payment information secure?',
        qKey: 'faq.q10',
        a: 'Absolutely. We use industry-standard SSL encryption and PCI-compliant payment processors. We never store your full credit card information on our servers. All payment processing is handled by trusted third-party providers (Stripe, PayPal).',
        aKey: 'faq.a10',
      },
      {
        q: 'Can I cancel or modify my order?',
        qKey: 'faq.q11',
        a: 'Orders can be modified or cancelled within 1 hour of placement. After that, orders enter processing and cannot be changed. Contact our support team immediately if you need to make changes: support@biocyclepeptides.com',
        aKey: 'faq.a11',
      },
      {
        q: 'Do you offer discounts for bulk orders?',
        qKey: 'faq.q12',
        a: 'Yes! We offer tiered pricing: 15% off orders over $300 CAD, and 20% off orders over $500 CAD. Discounts are applied automatically at checkout. For institutional or large research orders, contact us for custom pricing.',
        aKey: 'faq.a12',
      },
    ],
  },
  {
    name: 'Shipping & Delivery',
    nameKey: 'faq.category.shipping',
    icon: '🚚',
    questions: [
      {
        q: 'How long does shipping take?',
        qKey: 'faq.q13',
        a: `Shipping times:
• Canada: 1-3 business days (Xpresspost)
• USA: 3-7 business days
• International: 7-14 business days

All orders placed before 2PM EST ship same day. Tracking is provided for all orders.`,
        aKey: 'faq.a13',
      },
      {
        q: 'Do you offer free shipping?',
        qKey: 'faq.q14',
        a: 'Yes! Free shipping on orders over $150 CAD within Canada. For US and international orders, shipping is calculated at checkout based on destination and weight.',
        aKey: 'faq.a14',
      },
      {
        q: 'How are peptides shipped?',
        qKey: 'faq.q15',
        a: 'All peptides are shipped in temperature-controlled packaging with cold packs during warmer months. Packages are discreetly labeled with no indication of contents. We use vacuum-sealed vials and protective padding to ensure products arrive in perfect condition.',
        aKey: 'faq.a15',
      },
      {
        q: 'Do you ship internationally?',
        qKey: 'faq.q16',
        a: 'Yes, we ship to most countries worldwide including the USA, EU, UK, Australia, and many others. Some restrictions apply based on local regulations. International customers are responsible for any customs duties or import taxes that may apply.',
        aKey: 'faq.a16',
      },
      {
        q: 'What if my package is lost or damaged?',
        qKey: 'faq.q17',
        a: 'We fully insure all shipments. If your package is lost, damaged, or arrives with compromised products, contact us immediately with photos. We will either reship your order at no cost or provide a full refund.',
        aKey: 'faq.a17',
      },
    ],
  },
  {
    name: 'Returns & Refunds',
    nameKey: 'faq.category.returns',
    icon: '↩️',
    questions: [
      {
        q: 'What is your return policy?',
        qKey: 'faq.q18',
        a: 'Due to the nature of our products and quality control requirements, we cannot accept returns of opened products. Unopened, sealed products may be returned within 30 days for a full refund. Defective or damaged products will be replaced or refunded at our discretion.',
        aKey: 'faq.a18',
      },
      {
        q: 'How do I request a refund?',
        qKey: 'faq.q19',
        a: 'Contact our support team at support@biocyclepeptides.com with your order number and reason for the refund request. For damaged products, please include photos. Refunds are processed within 5-7 business days to the original payment method.',
        aKey: 'faq.a19',
      },
    ],
  },
  {
    name: 'Quality & Safety',
    nameKey: 'faq.category.quality',
    icon: '✅',
    questions: [
      {
        q: 'Where are your peptides manufactured?',
        qKey: 'faq.q20',
        a: 'Our peptides are manufactured in cGMP-compliant facilities in Canada. We work with WHO/GMP and ISO 9001:2015 certified laboratories to ensure the highest quality standards. All production follows strict quality control protocols.',
        aKey: 'faq.a20',
      },
      {
        q: 'What is a Certificate of Analysis (COA)?',
        qKey: 'faq.q21',
        a: 'A COA is a document from an independent laboratory that verifies the purity, identity, and quality of a peptide batch. It includes HPLC chromatograms, MS data, appearance, and other relevant test results. COAs are available for download on each product page.',
        aKey: 'faq.a21',
      },
      {
        q: 'Are your products legal?',
        qKey: 'faq.q22',
        a: 'Our research peptides are legal to purchase and possess in Canada and most other countries for legitimate research purposes. They are not approved as drugs or supplements. Buyers must be of legal age (18+) and agree to use products only for lawful research purposes.',
        aKey: 'faq.a22',
      },
    ],
  },
];

export default function FAQPage() {
  const { t } = useTranslations();
  const [activeCategory, setActiveCategory] = useState(0);
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (key: string) => {
    const newSet = new Set(openQuestions);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setOpenQuestions(newSet);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('faq.title') || 'Frequently Asked Questions'}
          </h1>
          <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
            {t('faq.subtitle') || 'Everything you need to know about our research peptides, ordering, and shipping.'}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Category Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-4">{t('faq.categories') || 'Categories'}</h3>
              <nav className="space-y-1">
                {faqCategories.map((category, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveCategory(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeCategory === index
                        ? 'bg-orange-50 text-orange-600 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{category.icon}</span>
                    <span>{t(category.nameKey) || category.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Questions */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <span className="text-3xl">{faqCategories[activeCategory].icon}</span>
                  {t(faqCategories[activeCategory].nameKey) || faqCategories[activeCategory].name}
                </h2>
              </div>
              
              <div className="divide-y divide-gray-100">
                {faqCategories[activeCategory].questions.map((item, qIndex) => {
                  const key = `${activeCategory}-${qIndex}`;
                  const isOpen = openQuestions.has(key);
                  
                  return (
                    <div key={qIndex} className="border-b border-gray-100 last:border-0">
                      <button
                        onClick={() => toggleQuestion(key)}
                        className="w-full flex items-start justify-between gap-4 p-6 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-gray-900">
                          {t(item.qKey) || item.q}
                        </span>
                        <svg
                          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {isOpen && (
                        <div className="px-6 pb-6">
                          <div className="pl-0 text-gray-600 whitespace-pre-line leading-relaxed">
                            {t(item.aKey) || item.a}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Contact CTA */}
            <div className="mt-8 bg-orange-50 rounded-xl p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('faq.stillHaveQuestions') || "Still have questions?"}
              </h3>
              <p className="text-gray-600 mb-4">
                {t('faq.contactUs') || "Our team is here to help with any questions about our products or your research needs."}
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                {t('faq.contactButton') || 'Contact Support'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Peptide Calculator Link */}
      <section className="py-12 bg-white border-t">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">{t('faq.calculatorTitle') || 'Need Help with Reconstitution?'}</h2>
          <p className="text-gray-600 mb-6">
            {t('faq.calculatorDesc') || 'Use our peptide calculator to determine the exact amount of bacteriostatic water needed for your research.'}
          </p>
          <Link
            href="/#calculator"
            className="inline-flex items-center gap-2 px-6 py-3 border-2 border-orange-500 text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
          >
            <span>🧮</span>
            {t('faq.calculatorButton') || 'Peptide Calculator'}
          </Link>
        </div>
      </section>
    </div>
  );
}
