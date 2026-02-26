import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notification Settings | BioCycle Peptides',
  description: 'Manage your email and notification preferences for orders, promotions, and research updates.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Notification Settings | BioCycle Peptides',
    description: 'Manage your email and notification preferences for orders, promotions, and research updates.',
  },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
