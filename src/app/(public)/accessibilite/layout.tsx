import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibilité',
  description: 'Notre engagement à rendre notre plateforme accessible à tous. Koraline respecte les normes WCAG pour une expérience inclusive.',
  openGraph: {
    title: 'Accessibilité | Koraline',
    description: 'Notre engagement à rendre notre plateforme accessible à tous.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/accessibilite`,
    siteName: 'Koraline',
    type: 'website',
  },
};

export default function AccessibilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
