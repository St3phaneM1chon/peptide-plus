import type { Metadata } from 'next';
import AccountSidebar from '@/components/account/AccountSidebar';

export const metadata: Metadata = {
  title: 'Mon compte',
  description: 'Gérez votre compte BioCycle Peptides, vos commandes, adresses et préférences.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Mon compte | BioCycle Peptides',
    description: 'Gérez votre compte BioCycle Peptides.',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
      <AccountSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
