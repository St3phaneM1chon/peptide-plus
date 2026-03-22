import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notre mission | BioCycle Peptides',
  description: 'Découvrez la mission de BioCycle Peptides : fournir des peptides de recherche de haute pureté testés en laboratoire pour faire avancer la science au Canada.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/mission`,
  },
  openGraph: {
    title: 'Notre mission | BioCycle Peptides',
    description: 'Découvrez la mission de BioCycle Peptides : fournir des peptides de recherche de haute pureté testés en laboratoire pour faire avancer la science au Canada.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/mission`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notre mission | BioCycle Peptides',
    description: 'Découvrez la mission de BioCycle Peptides : fournir des peptides de recherche de haute pureté testés en laboratoire pour faire avancer la science au Canada.',
  },
};

export default function MissionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
