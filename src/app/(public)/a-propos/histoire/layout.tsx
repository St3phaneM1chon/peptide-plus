import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notre histoire | Koraline',
  description: 'De sa fondation à Montréal à fournisseur de confiance au Canada, découvrez le parcours de Koraline et notre engagement envers la recherche peptidique.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/histoire`,
  },
  openGraph: {
    title: 'Notre histoire | Koraline',
    description: 'De sa fondation à Montréal à fournisseur de confiance au Canada, découvrez le parcours de Koraline et notre engagement envers la recherche peptidique.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/histoire`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notre histoire | Koraline',
    description: 'De sa fondation à Montréal à fournisseur de confiance au Canada, découvrez le parcours de Koraline et notre engagement envers la recherche peptidique.',
  },
};

export default function HistoireLayout({ children }: { children: React.ReactNode }) {
  return children;
}
