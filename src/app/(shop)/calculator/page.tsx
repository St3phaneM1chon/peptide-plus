import { Metadata } from 'next';
import CalculatorPageClient from './CalculatorPageClient';

export const metadata: Metadata = {
  title: 'Calculateur de dosage peptidique',
  description: 'Calculez votre dosage peptidique précis avec notre calculateur d\'injection gratuit. Déterminez la concentration, le volume d\'injection et les unités U100.',
  openGraph: {
    title: 'Calculateur de dosage peptidique | BioCycle Peptides',
    description: 'Calculateur d\'injection peptidique gratuit. Concentration, volume et unités U100.',
    url: 'https://biocyclepeptides.com/calculator',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function CalculatorPage() {
  return <CalculatorPageClient />;
}
