'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

interface CoaEntry {
  id: string;
  productName: string;
  batchNumber: string;
  testDate: string;
  purity: number | null;
  status: 'passed';
  pdfUrl: string;
  hplcUrl: string;
}

interface LabResultsClientProps {
  coaData: CoaEntry[];
}

export default function LabResultsClient({ coaData }: LabResultsClientProps) {
  const { t } = useTranslations();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('labResults.title') || 'Résultats de Laboratoire'}
          </h1>
          <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
            {t('labResults.subtitle') || 'Transparence totale. Chaque lot de nos produits est testé par des laboratoires tiers indépendants.'}
          </p>
        </div>
      </section>

      {/* Quality Badges */}
      <section className="py-12 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-6">
              <div className="text-4xl mb-3">🔬</div>
              <h3 className="font-bold text-lg mb-1">{t('labResults.thirdParty') || 'Tests Tiers'}</h3>
              <p className="text-sm text-gray-600">{t('labResults.thirdPartyDesc') || 'Laboratoires indépendants accrédités'}</p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="font-bold text-lg mb-1">{t('labResults.purity') || 'Pureté 99%+'}</h3>
              <p className="text-sm text-gray-600">{t('labResults.purityDesc') || 'Garantie sur tous nos peptides'}</p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-3">📄</div>
              <h3 className="font-bold text-lg mb-1">{t('labResults.coa') || 'COA Disponible'}</h3>
              <p className="text-sm text-gray-600">{t('labResults.coaDesc') || 'Certificat d\'analyse pour chaque lot'}</p>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl mb-3">🏆</div>
              <h3 className="font-bold text-lg mb-1">{t('labResults.hplc') || 'HPLC & MS'}</h3>
              <p className="text-sm text-gray-600">{t('labResults.hplcDesc') || 'Tests chromatographiques avancés'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* COA Table */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-6">{t('labResults.recentTests') || 'Tests Récents'}</h2>

          {coaData.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <span className="text-5xl mb-4 block">🔬</span>
              <h3 className="text-lg font-bold mb-2">{t('labResults.noResults') || 'Résultats à venir'}</h3>
              <p className="text-gray-500">{t('labResults.noResultsDesc') || 'Les certificats d\'analyse seront disponibles sous peu.'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      {t('labResults.product') || 'Produit'}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      {t('labResults.batch') || 'Lot'}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      {t('labResults.testDate') || 'Date du test'}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      {t('labResults.purityLabel') || 'Pureté'}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      {t('labResults.status') || 'Statut'}
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      {t('labResults.report') || 'Rapport'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coaData.map((coa) => (
                    <tr key={coa.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{coa.productName}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        {coa.batchNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(coa.testDate).toLocaleDateString('fr-CA')}
                      </td>
                      <td className="px-6 py-4">
                        {coa.purity ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {coa.purity}%
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">{t('labResults.passed') || 'Conforme'}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {coa.pdfUrl ? (
                          <a
                            href={coa.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 text-sm font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PDF
                          </a>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Testing Process */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8 text-center">{t('labResults.process') || 'Notre Processus de Test'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-orange-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">{t('labResults.step1Title') || 'Réception'}</h3>
              <p className="text-sm text-gray-600">{t('labResults.step1Desc') || 'Chaque lot est enregistré et échantillonné à réception'}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-orange-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">{t('labResults.step2Title') || 'Analyse HPLC'}</h3>
              <p className="text-sm text-gray-600">{t('labResults.step2Desc') || 'Chromatographie pour vérifier la pureté et l\'identité'}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-orange-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">{t('labResults.step3Title') || 'Spectrométrie MS'}</h3>
              <p className="text-sm text-gray-600">{t('labResults.step3Desc') || 'Confirmation de la masse moléculaire exacte'}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-orange-600 font-bold">4</span>
              </div>
              <h3 className="font-semibold mb-2">{t('labResults.step4Title') || 'Certification'}</h3>
              <p className="text-sm text-gray-600">{t('labResults.step4Desc') || 'COA généré et produit mis en stock'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-neutral-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-4">{t('labResults.ctaTitle') || 'Questions sur nos tests?'}</h2>
          <p className="text-neutral-400 mb-6">
            {t('labResults.ctaDesc') || 'Notre équipe est disponible pour répondre à toutes vos questions sur la qualité de nos produits.'}
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            {t('labResults.contactUs') || 'Nous contacter'}
          </Link>
        </div>
      </section>
    </div>
  );
}
