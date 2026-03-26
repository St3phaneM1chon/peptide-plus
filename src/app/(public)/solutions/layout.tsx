import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Solutions peptidiques pour la recherche | Koraline',
  description: 'Trouvez la solution peptidique adaptee a vos besoins de recherche. Entreprises, chercheurs individuels et partenaires au Canada et internationalement.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/solutions`,
  },
  openGraph: {
    title: 'Solutions peptidiques pour la recherche | Koraline',
    description: 'Trouvez la solution peptidique adaptee a vos besoins de recherche. Entreprises, chercheurs individuels et partenaires.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/solutions`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solutions peptidiques pour la recherche | Koraline',
    description: 'Trouvez la solution peptidique adaptee a vos besoins de recherche. Entreprises, chercheurs individuels et partenaires.',
  },
};

export default function SolutionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
