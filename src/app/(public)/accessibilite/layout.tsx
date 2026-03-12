import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibilité',
  description: 'Notre engagement à rendre notre plateforme accessible à tous. BioCycle Peptides respecte les normes WCAG pour une expérience inclusive.',
  openGraph: {
    title: 'Accessibilité | BioCycle Peptides',
    description: 'Notre engagement à rendre notre plateforme accessible à tous.',
    url: 'https://biocyclepeptides.com/accessibilite',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function AccessibilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
