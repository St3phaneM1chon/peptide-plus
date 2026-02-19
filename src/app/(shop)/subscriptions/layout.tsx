import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Subscribe & Save on Research Peptides',
  description: 'Set up automatic peptide deliveries and save up to 20% per order. Pause or cancel anytime. BioCycle Peptides subscription plans.',
};

export default function SubscriptionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
