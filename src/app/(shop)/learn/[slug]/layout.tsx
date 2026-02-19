import { Metadata } from 'next';

const ARTICLE_META: Record<string, { title: string; description: string }> = {
  'what-are-peptides': {
    title: 'What Are Peptides? A Beginner\'s Guide',
    description: 'Learn the basics of peptides, their types, and why they matter for scientific research.',
  },
  'how-to-reconstitute-peptides': {
    title: 'How to Reconstitute Peptides',
    description: 'Step-by-step guide to properly reconstituting lyophilized peptides for research use.',
  },
  'peptide-storage-guide': {
    title: 'Peptide Storage Guide',
    description: 'Best practices for storing peptides to maintain stability and potency.',
  },
  'understanding-coa-documents': {
    title: 'Understanding COA Documents',
    description: 'How to read and interpret Certificate of Analysis documents for research peptides.',
  },
  'bpc-157-research-overview': {
    title: 'BPC-157 Research Overview',
    description: 'Comprehensive overview of BPC-157 peptide research findings and mechanisms.',
  },
  'glp1-agonists-explained': {
    title: 'GLP-1 Agonists Explained',
    description: 'Understanding GLP-1 receptor agonists: mechanisms, research, and applications.',
  },
  'tb500-healing-peptide': {
    title: 'TB-500 Healing Peptide',
    description: 'Research overview of TB-500 (Thymosin Beta-4) and its regenerative properties.',
  },
  'peptide-calculator-guide': {
    title: 'Peptide Calculator Guide',
    description: 'How to use our peptide reconstitution calculator for accurate dosing.',
  },
};

export function generateStaticParams() {
  return Object.keys(ARTICLE_META).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = ARTICLE_META[slug];

  if (!meta) {
    return { title: 'Article Not Found' };
  }

  const ogImageUrl = `https://biocyclepeptides.com/api/og?title=${encodeURIComponent(meta.title)}&type=article`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `https://biocyclepeptides.com/learn/${slug}`,
    },
    openGraph: {
      title: `${meta.title} | BioCycle Peptides`,
      description: meta.description,
      url: `https://biocyclepeptides.com/learn/${slug}`,
      type: 'article',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: meta.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${meta.title} | BioCycle Peptides`,
      description: meta.description,
      images: [ogImageUrl],
    },
  };
}

export default function LearnArticleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
