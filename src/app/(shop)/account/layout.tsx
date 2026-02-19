import type { Metadata } from 'next';
import AccountSidebar from '@/components/account/AccountSidebar';

export const metadata: Metadata = {
  title: 'My Account',
  description: 'Manage your BioCycle Peptides account, orders, addresses, and preferences.',
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
      <AccountSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
