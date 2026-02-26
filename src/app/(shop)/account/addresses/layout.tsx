import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Addresses | BioCycle Peptides',
  description: 'Manage your saved shipping and billing addresses for faster checkout.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Addresses | BioCycle Peptides',
    description: 'Manage your saved shipping and billing addresses for faster checkout.',
  },
};

export default function AddressesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
