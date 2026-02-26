import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Account Settings | BioCycle Peptides',
  description: 'Manage your account security settings, password, two-factor authentication, and privacy preferences.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Account Settings | BioCycle Peptides',
    description: 'Manage your account security settings, password, two-factor authentication, and privacy preferences.',
  },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
