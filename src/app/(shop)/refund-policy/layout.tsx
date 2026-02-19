import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund & Return Policy',
  description: 'BioCycle Peptides refund and return policy. Learn about our 30-day return window, quality guarantee, and how to request a refund.',
};

export default function RefundPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
