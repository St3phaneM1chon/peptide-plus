import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { PlatformBreadcrumbs } from '@/components/marketing';

// PERF: Lazy-load the ROI calculator — heavy client component with charts/calculations
const ROICalculatorPage = dynamic(() => import('./ROICalculatorClient'), {
  loading: () => (
    <div className="max-w-4xl mx-auto px-4 py-24 text-center">
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-gray-200 rounded-lg w-3/4 mx-auto" />
        <div className="h-6 bg-gray-100 rounded w-1/2 mx-auto" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          <div className="h-48 bg-gray-100 rounded-2xl" />
          <div className="h-48 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    </div>
  ),
});

export const metadata: Metadata = {
  title: 'Calculateur ROI — Combien pourriez-vous economiser? | Attitudes VIP',
  description:
    'Calculez vos economies en centralisant vos outils avec la Suite Koraline. Entrez vos chiffres actuels et decouvrez votre retour sur investissement.',
  alternates: { canonical: 'https://attitudes.vip/platform/calculateur-roi' },
  openGraph: {
    title: 'Calculateur ROI — Suite Koraline',
    description:
      'Calculez vos economies en centralisant vos outils avec la Suite Koraline.',
    url: 'https://attitudes.vip/platform/calculateur-roi',
    siteName: 'Attitudes VIP',
    type: 'website',
    locale: 'fr_CA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calculateur ROI — Suite Koraline',
    description:
      'Calculez vos economies en centralisant vos outils avec la Suite Koraline.',
  },
};

export default function Page() {
  return (
    <>
      <PlatformBreadcrumbs
        items={[
          { label: 'Accueil', href: '/platform' },
          { label: 'Solutions', href: '/platform/pour/ecommerce' },
          { label: 'Calculateur ROI' },
        ]}
      />
      <ROICalculatorPage />
    </>
  );
}
