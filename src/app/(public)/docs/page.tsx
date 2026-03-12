import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Documentation et foire aux questions BioCycle Peptides.',
  alternates: {
    canonical: 'https://biocyclepeptides.com/faq',
  },
};

export default function DocsPage() {
  redirect('/faq');
}
