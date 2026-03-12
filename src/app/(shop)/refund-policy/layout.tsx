import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de remboursement',
  description: 'Politique de remboursement et de retour BioCycle Peptides. Fenêtre de retour de 30 jours, garantie qualité et procédure de remboursement.',
  openGraph: {
    title: 'Politique de remboursement | BioCycle Peptides',
    description: 'Fenêtre de retour de 30 jours, garantie qualité et procédure de remboursement.',
    url: 'https://biocyclepeptides.com/refund-policy',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function RefundPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
