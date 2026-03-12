import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Support et assistance BioCycle Peptides. Contactez notre équipe bilingue.',
  alternates: {
    canonical: 'https://biocyclepeptides.com/contact',
  },
};

export default function SupportPage() {
  redirect('/contact');
}
