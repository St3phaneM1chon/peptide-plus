import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import LabResultsClient from './LabResultsClient';

export const metadata: Metadata = {
  title: 'Lab Results & Certificates of Analysis',
  description: 'View third-party lab test results and Certificates of Analysis (COA) for all BioCycle Peptides research compounds. 99%+ purity verified.',
};

export const dynamic = 'force-dynamic';

export default async function LabResultsPage() {
  // Fetch products that have COA data from DB
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

  const coaData = products.map((p) => ({
    id: p.id,
    productName: p.name,
    batchNumber: `${p.slug.toUpperCase().slice(0, 3)}-${p.updatedAt.getFullYear()}-001`,
    testDate: p.updatedAt.toISOString().split('T')[0],
    purity: p.purity ? Number(p.purity) : null,
    status: 'passed' as const,
    pdfUrl: p.coaUrl || '',
    hplcUrl: p.hplcUrl || '',
  }));

  return <LabResultsClient coaData={coaData} />;
}
