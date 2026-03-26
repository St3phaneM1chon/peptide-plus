import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nos valeurs | Koraline',
  description: 'Rigueur scientifique, intégrité, innovation et responsabilité : les 6 valeurs fondamentales qui guident Koraline dans la recherche peptidique.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/valeurs`,
  },
  openGraph: {
    title: 'Nos valeurs | Koraline',
    description: 'Rigueur scientifique, intégrité, innovation et responsabilité : les 6 valeurs fondamentales qui guident Koraline dans la recherche peptidique.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/valeurs`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nos valeurs | Koraline',
    description: 'Rigueur scientifique, intégrité, innovation et responsabilité : les 6 valeurs fondamentales qui guident Koraline dans la recherche peptidique.',
  },
};

export default function ValeursLayout({ children }: { children: React.ReactNode }) {
  return children;
}
