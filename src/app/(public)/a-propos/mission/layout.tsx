import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Mission | BioCycle Peptides',
  description: 'BioCycle Peptides mission: advancing scientific research by providing third-party tested, high-purity peptides to researchers across Canada.',
  openGraph: {
    title: 'Our Mission | BioCycle Peptides',
    description: 'BioCycle Peptides mission: advancing scientific research by providing third-party tested, high-purity peptides to researchers across Canada.',
  },
};

export default function MissionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
