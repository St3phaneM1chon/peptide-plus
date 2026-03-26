import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Find help and support for using the Koraline platform. FAQ, guides, and technical assistance.',
  openGraph: {
    title: 'Help Center | Koraline',
    description: 'Find help and support for using the Koraline platform.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/aide`,
    siteName: 'Koraline',
    type: 'website',
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
