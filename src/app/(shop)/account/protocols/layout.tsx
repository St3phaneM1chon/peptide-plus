import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: `My Research Protocols | ${siteName}`,
  description: 'Manage your saved research protocols and product usage documentation.',
  robots: { index: false, follow: false },
  openGraph: {
    title: `My Research Protocols | ${siteName}`,
    description: 'Manage your saved research protocols and product usage documentation.',
  },
};

export default function ProtocolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
