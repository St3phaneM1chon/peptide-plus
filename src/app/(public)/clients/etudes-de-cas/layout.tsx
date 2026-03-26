import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Études de cas | Koraline',
  description: 'Découvrez comment nos clients utilisent les peptides de recherche Koraline pour atteindre leurs objectifs scientifiques.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients/etudes-de-cas`,
  },
  openGraph: {
    title: 'Études de cas | Koraline',
    description: 'Découvrez comment nos clients utilisent les peptides de recherche Koraline pour atteindre leurs objectifs scientifiques.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients/etudes-de-cas`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Études de cas | Koraline',
    description: 'Découvrez comment nos clients utilisent les peptides de recherche Koraline pour atteindre leurs objectifs scientifiques.',
  },
};

export default function CaseStudiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
