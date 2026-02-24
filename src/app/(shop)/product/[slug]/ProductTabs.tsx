'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useI18n } from '@/i18n/client';

const ProductVideo = dynamic(() => import('@/components/shop/ProductVideo'), { ssr: false });

interface ChemistryData {
  researchSummary?: string;
  reconstitution?: {
    solvent: string;
    volume: string;
    notes?: string;
  };
  hplcPurity?: number;
  casNumber?: string;
  molecularWeight?: number;
  molecularFormula?: string;
  appearance?: string;
  solubility?: string;
  sequence?: string;
  synonyms?: string[];
  storage?: {
    lyophilized: string;
    reconstituted: string;
  };
  coaAvailable?: boolean;
  mechanism?: string;
  references?: Array<{
    title: string;
    pubmedId?: string;
  }>;
}

interface ProductTabsProps {
  product: {
    slug: string;
    purity?: number;
    avgMass?: string;
    casNumber?: string;
    molecularWeight?: number;
    molecularFormula?: string;
    description: string;
    shortDescription: string;
    specifications: string;
    videoUrl?: string;
  };
  chemistryData: ChemistryData | null | undefined;
}

const validTabs = ['description', 'specs', 'research', 'reconstitution', 'video'] as const;
type TabType = typeof validTabs[number];

function getInitialTab(): TabType {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '') as TabType;
    if (validTabs.includes(hash)) return hash;
  }
  return 'description';
}

export default function ProductTabs({ product, chemistryData }: ProductTabsProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  };

  return (
    <div className="mt-12 border-t pt-8">
      <div className="flex flex-nowrap overflow-x-auto gap-4 md:gap-6 border-b mb-6" role="tablist" aria-label={t('shop.aria.productInfoTabs')}>
        <button
          role="tab"
          id="tab-description"
          aria-selected={activeTab === 'description'}
          aria-controls="tabpanel-description"
          onClick={() => handleTabChange('description')}
          className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
            activeTab === 'description'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-neutral-500 hover:text-black'
          }`}
        >
          {t('shop.description')}
        </button>
        <button
          role="tab"
          id="tab-specs"
          aria-selected={activeTab === 'specs'}
          aria-controls="tabpanel-specs"
          onClick={() => handleTabChange('specs')}
          className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
            activeTab === 'specs'
              ? 'text-orange-600 border-b-2 border-orange-600'
              : 'text-neutral-500 hover:text-black'
          }`}
        >
          {t('shop.specifications')}
        </button>
        {chemistryData?.researchSummary && (
          <button
            role="tab"
            id="tab-research"
            aria-selected={activeTab === 'research'}
            aria-controls="tabpanel-research"
            onClick={() => handleTabChange('research')}
            className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
              activeTab === 'research'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-neutral-500 hover:text-black'
            }`}
          >
            🔬 {t('shop.research') || 'Research'}
          </button>
        )}
        {chemistryData?.reconstitution && (
          <button
            role="tab"
            id="tab-reconstitution"
            aria-selected={activeTab === 'reconstitution'}
            aria-controls="tabpanel-reconstitution"
            onClick={() => handleTabChange('reconstitution')}
            className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
              activeTab === 'reconstitution'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-neutral-500 hover:text-black'
            }`}
          >
            💉 {t('shop.reconstitution') || 'Reconstitution'}
          </button>
        )}
        {product.videoUrl && (
          <button
            role="tab"
            id="tab-video"
            aria-selected={activeTab === 'video'}
            aria-controls="tabpanel-video"
            onClick={() => handleTabChange('video')}
            className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
              activeTab === 'video'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-neutral-500 hover:text-black'
            }`}
          >
            🎥 {t('shop.video') || 'Video'}
          </button>
        )}
      </div>

      {/* Description Tab */}
      {activeTab === 'description' && (
        <div role="tabpanel" id="tabpanel-description" aria-labelledby="tab-description" className="prose max-w-none animate-tab-fade">
          {(product.description || product.shortDescription) ? (
            (product.description || product.shortDescription).split('\n').map((p, i) => (
              <p key={i} className="mb-4 text-neutral-700 leading-relaxed">{p}</p>
            ))
          ) : (
            <p className="text-neutral-400 italic">{t('shop.noDescription') || 'Description coming soon.'}</p>
          )}
          {/* Chemistry enrichment from local data */}
          {chemistryData?.researchSummary && !product.description && (
            <div className="mt-6 p-4 bg-neutral-50 rounded-lg border">
              <h3 className="font-semibold text-neutral-800 mb-2">{t('shop.researchContext') || 'Research Context'}</h3>
              {chemistryData.researchSummary.split('\n').map((p, i) => (
                <p key={`rc-${i}`} className="mb-2 text-neutral-600 text-sm leading-relaxed">{p}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Specifications Tab */}
      {activeTab === 'specs' && (
        <div role="tabpanel" id="tabpanel-specs" aria-labelledby="tab-specs" className="bg-neutral-50 rounded-lg p-6 animate-tab-fade">
          {/* COA Download Button */}
          {chemistryData?.coaAvailable && (
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  window.open(`/lab-results?product=${product.slug}`, '_blank');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('shop.downloadCOA') || 'Download COA (PDF)'}
              </button>
              <button
                onClick={() => {
                  window.open(`/lab-results?product=${product.slug}#hplc`, '_blank');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {t('shop.viewHPLC') || 'View HPLC Results'}
              </button>
            </div>
          )}

          {/* Chemical Properties Grid */}
          <h3 className="font-semibold text-lg mb-4">{t('shop.chemicalProperties') || 'Chemical Properties'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {(product.purity || chemistryData?.hplcPurity) && (
              <div className="flex justify-between border-b border-neutral-200 pb-3">
                <span className="text-neutral-500">{t('shop.hplcPurity') || 'HPLC Purity'}</span>
                <span className="font-bold text-green-600">{chemistryData?.hplcPurity || product.purity}%</span>
              </div>
            )}
            {product.avgMass && (
              <div className="flex justify-between border-b border-neutral-200 pb-3">
                <span className="text-neutral-500">{t('shop.avgMass')}</span>
                <span className="font-medium">{product.avgMass}</span>
              </div>
            )}
            {(product.casNumber || chemistryData?.casNumber) && (
              <div className="flex justify-between border-b border-neutral-200 pb-3">
                <span className="text-neutral-500">{t('shop.casNumber') || 'CAS Number'}</span>
                <span className="font-mono text-sm">{chemistryData?.casNumber || product.casNumber}</span>
              </div>
            )}
            {(product.molecularWeight || chemistryData?.molecularWeight) && (
              <div className="flex justify-between border-b border-neutral-200 pb-3">
                <span className="text-neutral-500">{t('shop.molecularWeight') || 'Molecular Weight'}</span>
                <span className="font-mono">{chemistryData?.molecularWeight || product.molecularWeight} Da</span>
              </div>
            )}
            {(product.molecularFormula || chemistryData?.molecularFormula) && (
              <div className="flex justify-between border-b border-neutral-200 pb-3">
                <span className="text-neutral-500">{t('shop.molecularFormula') || 'Molecular Formula'}</span>
                <span className="font-mono text-sm">{chemistryData?.molecularFormula || product.molecularFormula}</span>
              </div>
            )}
            {chemistryData?.appearance && (
              <div className="flex justify-between border-b border-neutral-200 pb-3">
                <span className="text-neutral-500">{t('shop.appearance') || 'Appearance'}</span>
                <span className="font-medium">{chemistryData.appearance}</span>
              </div>
            )}
            {chemistryData?.solubility && (
              <div className="flex justify-between border-b border-neutral-200 pb-3">
                <span className="text-neutral-500">{t('shop.solubility') || 'Solubility'}</span>
                <span className="font-medium text-sm">{chemistryData.solubility}</span>
              </div>
            )}
          </div>

          {/* Amino Acid Sequence */}
          {chemistryData?.sequence && (
            <div className="mb-6">
              <h4 className="font-medium text-neutral-700 mb-2">{t('shop.sequence') || 'Amino Acid Sequence'}</h4>
              <code className="block bg-white p-3 rounded-lg border font-mono text-sm text-neutral-600 break-all">
                {chemistryData.sequence}
              </code>
            </div>
          )}

          {/* Synonyms */}
          {chemistryData?.synonyms && chemistryData.synonyms.length > 0 && (
            <div className="mb-6">
              <h4 className="font-medium text-neutral-700 mb-2">{t('shop.synonyms') || 'Also Known As'}</h4>
              <div className="flex flex-wrap gap-2">
                {chemistryData.synonyms.map((syn, i) => (
                  <span key={i} className="px-3 py-1 bg-white rounded-full text-sm text-neutral-600 border">
                    {syn}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Storage Conditions */}
          {chemistryData?.storage && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <span>❄️</span> {t('shop.storageInstructions') || 'Storage Instructions'}
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li><strong>Lyophilized:</strong> {chemistryData.storage.lyophilized}</li>
                <li><strong>Reconstituted:</strong> {chemistryData.storage.reconstituted}</li>
              </ul>
            </div>
          )}

          {product.specifications && (
            <div className="mt-6">
              <h4 className="font-medium text-neutral-700 mb-2">{t('shop.additionalSpecs') || 'Additional Specifications'}</h4>
              <pre className="whitespace-pre-wrap text-sm text-neutral-600 bg-white p-4 rounded-lg border">
                {product.specifications}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Research Tab */}
      {activeTab === 'research' && chemistryData?.researchSummary && (
        <div role="tabpanel" id="tabpanel-research" aria-labelledby="tab-research" className="bg-neutral-50 rounded-lg p-6 animate-tab-fade">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">🔬</span>
            <h3 className="font-bold text-xl">{t('shop.researchOverview') || 'Research Overview'}</h3>
          </div>

          <div className="prose max-w-none mb-6">
            {chemistryData.researchSummary.split('\n').map((p, i) => (
              <p key={i} className="mb-3 text-neutral-700 leading-relaxed">{p}</p>
            ))}
          </div>

          {chemistryData.mechanism && (
            <div className="bg-white border rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-neutral-800 mb-2">{t('shop.mechanism') || 'Mechanism of Action'}</h4>
              <p className="text-neutral-600 text-sm">{chemistryData.mechanism}</p>
            </div>
          )}

          {chemistryData.references && chemistryData.references.length > 0 && (
            <div>
              <h4 className="font-semibold text-neutral-800 mb-3">{t('shop.references') || 'Scientific References'}</h4>
              <ul className="space-y-2">
                {chemistryData.references.map((ref, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-orange-500 mt-1">📄</span>
                    <span className="text-neutral-600">
                      {ref.title}
                      {ref.pubmedId && (
                        <a
                          href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pubmedId}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ms-2 text-blue-600 hover:underline"
                        >
                          [PubMed: {ref.pubmedId}]
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              <strong>{t('disclaimer.title')}:</strong> {t('disclaimer.educationalPurposes') || 'This information is for educational purposes only. All products are sold for research use only and are not intended for human consumption.'}
            </p>
          </div>
        </div>
      )}

      {/* Reconstitution Tab */}
      {activeTab === 'reconstitution' && chemistryData?.reconstitution && (
        <div role="tabpanel" id="tabpanel-reconstitution" aria-labelledby="tab-reconstitution" className="bg-neutral-50 rounded-lg p-6 animate-tab-fade">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">💉</span>
            <h3 className="font-bold text-xl">{t('shop.reconstitutionGuide') || 'Reconstitution Guide'}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-neutral-500 mb-1">{t('shop.recommendedSolvent') || 'Recommended Solvent'}</p>
              <p className="font-semibold text-neutral-800">{chemistryData.reconstitution.solvent}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-neutral-500 mb-1">{t('shop.recommendedVolume') || 'Recommended Volume'}</p>
              <p className="font-semibold text-neutral-800">{chemistryData.reconstitution.volume}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-neutral-500 mb-1">{t('shop.stability') || 'Stability After Reconstitution'}</p>
              <p className="font-semibold text-neutral-800">{chemistryData.storage?.reconstituted.split('for ')[1] || '14-30 days at 2-8°C'}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border mb-6">
            <h4 className="font-semibold text-neutral-800 mb-3">{t('shop.reconstitutionSteps') || 'Step-by-Step Instructions'}</h4>
            <ol className="space-y-3 text-sm text-neutral-600">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <span>{t('shop.reconstitutionStep1') || 'Allow the vial to reach room temperature before reconstitution.'}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <span>{t('shop.reconstitutionStep2') || 'Wipe the rubber stopper with an alcohol swab and let it dry.'}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <span>{(t('shop.reconstitutionStep3') || 'Draw {volume} of {solvent} into a sterile syringe.').replace('{volume}', chemistryData.reconstitution.volume).replace('{solvent}', chemistryData.reconstitution.solvent)}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                <span>{t('shop.reconstitutionStep4') || 'Insert needle through stopper and slowly release water along the inside wall of the vial.'}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                <span>{t('shop.reconstitutionStep5') || 'Do NOT shake. Gently swirl or let sit until fully dissolved.'}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">6</span>
                <span>{t('shop.reconstitutionStep6') || 'Store reconstituted peptide in refrigerator (2-8°C).'}</span>
              </li>
            </ol>
          </div>

          {chemistryData.reconstitution.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                <span>⚠️</span> {t('shop.importantNotes') || 'Important Notes'}
              </h4>
              <p className="text-sm text-yellow-700">{chemistryData.reconstitution.notes}</p>
            </div>
          )}

          {/* Calculator Link */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <p className="text-sm text-orange-700 mb-3">
              {t('shop.needHelpCalculating') || 'Need help calculating your reconstitution? Use our peptide calculator.'}
            </p>
            <Link
              href="/#calculator"
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
            >
              🧮 {t('shop.openPeptideCalculator') || 'Open Peptide Calculator'}
            </Link>
          </div>
        </div>
      )}

      {/* Video Tab */}
      {activeTab === 'video' && product.videoUrl && (
        <div role="tabpanel" id="tabpanel-video" aria-labelledby="tab-video" className="bg-neutral-50 rounded-lg p-6 animate-tab-fade">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">🎥</span>
            <h3 className="font-bold text-xl">{t('shop.productVideo') || 'Product Video'}</h3>
          </div>

          <ProductVideo videoUrl={product.videoUrl} />

          <p className="mt-4 text-sm text-neutral-600">
            {t('shop.videoDescription') || 'Watch this video to learn more about this product, its benefits, and how to use it properly.'}
          </p>
        </div>
      )}
    </div>
  );
}
