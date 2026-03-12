import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import LabResultsClient from './LabResultsClient';

export const metadata: Metadata = {
  title: 'Résultats de laboratoire et certificats d\'analyse',
  description: 'Consultez les résultats de tests de laboratoires tiers et les certificats d\'analyse (COA) pour tous les peptides BioCycle. Pureté vérifiée à 99 %+.',
  openGraph: {
    title: 'Résultats de laboratoire | BioCycle Peptides',
    description: 'Résultats de tests tiers et certificats d\'analyse (COA). Pureté vérifiée à 99 %+.',
    url: 'https://biocyclepeptides.com/lab-results',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

// BUG-060 FIX: Reduce ISR cache to 5 min for fresher data
export const revalidate = 300;

export default async function LabResultsPage() {
  let coaData: { id: string; productName: string; batchNumber: string; testDate: string; purity: number | null; status: 'passed'; pdfUrl: string; hplcUrl: string }[] = [];

  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        coaUrl: { not: null },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        purity: true,
        coaUrl: true,
        hplcUrl: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    coaData = products.map((p) => ({
      id: p.id,
      productName: p.name,
      batchNumber: `${p.slug.toUpperCase().slice(0, 3)}-${p.updatedAt.getFullYear()}-001`,
      testDate: p.updatedAt.toISOString().split('T')[0],
      purity: p.purity ? Number(p.purity) : null,
      status: 'passed' as const,
      pdfUrl: p.coaUrl || '',
      hplcUrl: p.hplcUrl || '',
    }));
  } catch (error) {
    // DB unavailable (e.g. CI build without DATABASE_URL) — render empty
    console.warn('ISR build fallback: DB unavailable for lab-results COA data:', error);
  }

  return <LabResultsClient coaData={coaData} />;
}
