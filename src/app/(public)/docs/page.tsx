import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Documentation et foire aux questions BioCycle Peptides.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/faq`,
  },
};

export default function DocsPage() {
  redirect('/faq');
}
