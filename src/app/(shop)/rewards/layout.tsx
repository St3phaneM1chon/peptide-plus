import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: 'Programme de récompenses',
  description: `Accumulez des points à chaque achat et échangez-les contre des rabais. Rejoignez le programme de fidélité ${siteName}.`,
  openGraph: {
    title: `Programme de récompenses | ${siteName}`,
    description: 'Accumulez des points et échangez-les contre des rabais sur vos achats.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/rewards`,
    siteName,
    type: 'website',
  },
};

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
