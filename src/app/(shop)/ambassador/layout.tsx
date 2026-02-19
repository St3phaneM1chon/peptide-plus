import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ambassador Program',
  description: 'Join the BioCycle Peptides ambassador program and earn up to 20% commission sharing research peptides you trust with your audience.',
};

export default function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
