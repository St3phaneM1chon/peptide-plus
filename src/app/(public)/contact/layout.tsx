import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with BioCycle Peptides. Montreal-based Canadian supplier of research peptides. Bilingual support available.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
