import { Metadata } from 'next';
import { prisma } from '@/lib/db';

// BUG-060 FIX: Reduce ISR cache to 5 min for fresher data
export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const bundles = await prisma.bundle.findMany({
      where: { isActive: true },
      select: { slug: true },
    });
    return bundles.map((b) => ({ slug: b.slug }));
  } catch (error) {
    // DB unavailable during build - pages will be generated on first request via ISR
    console.warn('ISR build fallback: DB unavailable for generateStaticParams (bundles):', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await prisma.bundle.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });

  if (!bundle) {
    return { title: 'Bundle Not Found' };
  }

  const ogImageUrl = `https://biocyclepeptides.com/api/og?title=${encodeURIComponent(bundle.name)}&type=product&subtitle=Bundle`;

  return {
    title: bundle.name,
    description: bundle.description || `${bundle.name} - Research peptide bundle`,
    alternates: {
      canonical: `https://biocyclepeptides.com/bundles/${slug}`,
    },
    openGraph: {
      title: `${bundle.name} | BioCycle Peptides`,
      description: bundle.description || `${bundle.name} - Research peptide bundle`,
      url: `https://biocyclepeptides.com/bundles/${slug}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: bundle.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${bundle.name} | BioCycle Peptides`,
      description: bundle.description || `${bundle.name} - Research peptide bundle`,
      images: [ogImageUrl],
    },
  };
}

export default function BundleDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
