'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

interface ClientReference {
  id: string;
  name: string;
  logoUrl: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function ReferencesPage() {
  const { t } = useTranslations();
  const [byIndustry, setByIndustry] = useState<Record<string, ClientReference[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client-references')
      .then((res) => res.json())
      .then((data) => {
        setByIndustry(data.byIndustry || {});
      })
      .catch((err) => {
        console.error('Failed to fetch client references:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const industries = Object.keys(byIndustry);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-neutral-900 text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6">
            {t('references.title')}
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed">
            {t('references.heroText')}
          </p>
        </div>
      </section>

      {/* Clients by Industry */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-500">{t('references.loading')}</p>
            </div>
          ) : industries.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500">{t('references.noReferences')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {industries.map((industry, i) => (
                <div key={i} className="bg-white rounded-2xl p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {industry}
                    </h2>
                    <span className="text-sm text-gray-400">
                      {byIndustry[industry].length} {t('references.clients')}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {byIndustry[industry].map((client, j) => (
                      <span
                        key={j}
                        className="px-4 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-700"
                      >
                        {client.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Stats Summary */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            <div>
              <p className="text-4xl font-bold text-gray-900">500+</p>
              <p className="text-sm text-gray-500 mt-1">{t('references.statsResearchers')}</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900">12</p>
              <p className="text-sm text-gray-500 mt-1">{t('references.statsCountries')}</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900">500+</p>
              <p className="text-sm text-gray-500 mt-1">{t('references.statsProducts')}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            {t('references.disclaimer')}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          {t('references.needRefsTitle')}
        </h2>
        <p className="text-gray-600 mb-6">
          {t('references.needRefsText')}
        </p>
        <Link
          href="/contact"
          className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
        >
          {t('references.contactUs')}
        </Link>
      </section>
    </div>
  );
}
