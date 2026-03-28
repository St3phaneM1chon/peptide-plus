export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: `My Products | ${siteName}`,
  description: 'View and manage the products associated with your account.',
  robots: { index: false, follow: false },
  openGraph: {
    title: `My Products | ${siteName}`,
    description: 'View and manage the products associated with your account.',
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
