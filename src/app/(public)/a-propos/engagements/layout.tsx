import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nos engagements | BioCycle Peptides',
  description: 'Qualité, transparence, éthique et environnement : découvrez les 5 engagements fondamentaux de BioCycle Peptides envers la communauté scientifique canadienne.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/engagements`,
  },
  openGraph: {
    title: 'Nos engagements | BioCycle Peptides',
    description: 'Qualité, transparence, éthique et environnement : découvrez les 5 engagements fondamentaux de BioCycle Peptides envers la communauté scientifique canadienne.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/engagements`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nos engagements | BioCycle Peptides',
    description: 'Qualité, transparence, éthique et environnement : découvrez les 5 engagements fondamentaux de BioCycle Peptides envers la communauté scientifique canadienne.',
  },
};

export default function EngagementsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
