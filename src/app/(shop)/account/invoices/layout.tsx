import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Invoices | BioCycle Peptides',
  description: 'Access and download your invoices and billing documents from BioCycle Peptides.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Invoices | BioCycle Peptides',
    description: 'Access and download your invoices and billing documents from BioCycle Peptides.',
  },
};

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
