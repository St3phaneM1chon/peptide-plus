import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité | Koraline',
  description: 'Découvrez comment Koraline collecte, utilise et protège vos renseignements personnels. Conforme RGPD, PIPEDA et Loi 25.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/mentions-legales/confidentialite`,
  },
  openGraph: {
    title: 'Politique de confidentialité | Koraline',
    description: 'Découvrez comment Koraline collecte, utilise et protège vos renseignements personnels. Conforme RGPD, PIPEDA et Loi 25.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/mentions-legales/confidentialite`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Politique de confidentialité | Koraline',
    description: 'Découvrez comment Koraline collecte, utilise et protège vos renseignements personnels.',
  },
};

export default function ConfidentialiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
