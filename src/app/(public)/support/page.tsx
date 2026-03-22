import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Support et assistance BioCycle Peptides. Contactez notre équipe bilingue.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/contact`,
  },
};

export default function SupportPage() {
  redirect('/contact');
}
