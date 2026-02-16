'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

// Map DB category slugs to display names and icons
const categoryMeta: Record<string, { name: string; nameKey: string; icon: string }> = {
  'about-peptides': { name: 'About Peptides', nameKey: 'faq.category.aboutPeptides', icon: '\uD83D\uDD2C' },
  'reconstitution': { name: 'Reconstitution & Storage', nameKey: 'faq.category.reconstitution', icon: '\uD83D\uDC89' },
  'ordering': { name: 'Ordering & Payment', nameKey: 'faq.category.ordering', icon: '\uD83D\uDED2' },
  'shipping': { name: 'Shipping & Delivery', nameKey: 'faq.category.shipping', icon: '\uD83D\uDE9A' },
  'returns': { name: 'Returns & Refunds', nameKey: 'faq.category.returns', icon: '\u21A9\uFE0F' },
  'quality': { name: 'Quality & Safety', nameKey: 'faq.category.quality', icon: '\u2705' },
  // Fallback for general or any other category
  'general': { name: 'General', nameKey: 'faq.category.general', icon: '\u2753' },
};

function getCategoryMeta(category: string) {
  return categoryMeta[category] || { name: category, nameKey: '', icon: '\u2753' };
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
}

interface FaqCategory {
  name: string;
  nameKey: string;
  icon: string;
  questions: { question: string; answer: string }[];
}

export default function FAQPage() {
  const { t, locale } = useTranslations();
  const [activeCategory, setActiveCategory] = useState(0);
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());
  const [faqCategories, setFaqCategories] = useState<FaqCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFaqs() {
      try {
        const res = await fetch(`/api/faq?locale=${locale}`);
        const data = await res.json();
        const byCategory: Record<string, { question: string; answer: string }[]> = data.byCategory || {};

        // Build categories array from grouped data
        const categories: FaqCategory[] = Object.entries(byCategory).map(([cat, questions]) => {
          const meta = getCategoryMeta(cat);
          return {
            name: meta.name,
            nameKey: meta.nameKey,
            icon: meta.icon,
            questions,
          };
        });

        setFaqCategories(categories);
      } catch (error) {
        console.error('Failed to fetch FAQs:', error);
        setFaqCategories([]);
      } finally {
        setLoading(false);
      }
    }

    fetchFaqs();
  }, []);

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
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
            <p className="text-gray-500">{t('faq.loading') || 'Loading FAQs...'}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && faqCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-gray-500 text-lg mb-4">
              {t('faq.empty') || 'No FAQs available at the moment.'}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              {t('faq.contactButton') || 'Contact Support'}
            </Link>
          </div>
        )}

        {/* FAQ Content */}
        {!loading && faqCategories.length > 0 && (
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
                      <span>{(category.nameKey && t(category.nameKey)) || category.name}</span>
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
                    {(faqCategories[activeCategory].nameKey && t(faqCategories[activeCategory].nameKey)) || faqCategories[activeCategory].name}
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
                            {item.question}
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
                              {item.answer}
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
        )}
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
            <span>{'\uD83E\uDDEE'}</span>
            {t('faq.calculatorButton') || 'Peptide Calculator'}
          </Link>
        </div>
      </section>
    </div>
  );
}
