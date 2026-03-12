import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation API',
  description: 'Documentation complète de l\'API BioCycle Peptides. Endpoints, authentification, exemples de requêtes et guides d\'intégration.',
  openGraph: {
    title: 'Documentation API | BioCycle Peptides',
    description: 'Documentation complète de l\'API BioCycle Peptides.',
    url: 'https://biocyclepeptides.com/api-docs',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
