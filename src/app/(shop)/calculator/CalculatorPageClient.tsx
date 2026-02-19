'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

const PeptideCalculator = dynamic(() => import('@/components/shop/PeptideCalculator'), {
  loading: () => <div className="animate-pulse h-48 bg-neutral-800 rounded-xl" />,
  ssr: false,
});

export default function CalculatorPageClient() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Breadcrumb */}
      <div className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-neutral-400">
            <Link href="/" className="hover:text-white">{t('nav.home') || 'Home'}</Link>
            <span>/</span>
            <span className="text-white">{t('nav.injectionCalculator') || 'Injection Calculator'}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {t('calculator.title') || 'Peptide Injection Calculator'}
          </h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            {t('calculator.subtitle') || 'Calculate your precise peptide dosage. Enter the peptide amount, solvent volume, and desired dose to get your injection parameters.'}
          </p>
        </div>

        {/* Calculator */}
        <div className="max-w-5xl mx-auto">
          <PeptideCalculator />
        </div>

        {/* Info Section */}
        <div className="max-w-4xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">💉</span>
            </div>
            <h3 className="text-white font-semibold mb-2">
              {t('calculator.step1Title') || 'Peptide Amount'}
            </h3>
            <p className="text-neutral-400 text-sm">
              {t('calculator.step1Desc') || 'Enter the total amount of peptide in your vial (in mg), as indicated on the label.'}
            </p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">💧</span>
            </div>
            <h3 className="text-white font-semibold mb-2">
              {t('calculator.step2Title') || 'Solvent Volume'}
            </h3>
            <p className="text-neutral-400 text-sm">
              {t('calculator.step2Desc') || 'Enter the amount of bacteriostatic water you will use to reconstitute (in mL).'}
            </p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-white font-semibold mb-2">
              {t('calculator.step3Title') || 'Desired Dose'}
            </h3>
            <p className="text-neutral-400 text-sm">
              {t('calculator.step3Desc') || 'Enter the dose you want per injection in mcg or mg. The calculator shows the exact volume to draw.'}
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="max-w-4xl mx-auto mt-8 p-4 bg-amber-900/20 border border-amber-800/50 rounded-lg">
          <p className="text-sm text-amber-400/80 text-center">
            <strong className="text-amber-400">{t('disclaimer.title') || 'Research Use Only'}:</strong>{' '}
            {t('calculator.disclaimer') || 'This calculator is provided for informational purposes only for in vitro research. All products are intended for laboratory and research purposes only.'}
          </p>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold"
          >
            {t('shop.shopNow') || 'Shop Now'}
          </Link>
        </div>
      </div>
    </div>
  );
}
