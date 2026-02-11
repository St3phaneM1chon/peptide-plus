import { Metadata } from 'next';
import CalculatorPageClient from './CalculatorPageClient';

export const metadata: Metadata = {
  title: 'Peptide Injection Calculator | BioCycle Peptides',
  description: 'Calculate your precise peptide dosage with our free injection calculator. Determine concentration, injection volume, and U100 units.',
};

export default function CalculatorPage() {
  return <CalculatorPageClient />;
}
