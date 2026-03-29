export const revalidate = 300; // ISR: revalidate every 5 minutes

import { Metadata } from 'next';
import { getSiteSettings, parseBusinessHours } from '@/lib/content-pages';
import ContactPageClient from './ContactPageClient';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

export async function generateMetadata(): Promise<Metadata> {
  const title = `Contactez-nous | ${siteName}`;
  const description = `Contactez l'équipe ${siteName}. Nous sommes là pour vous aider à réussir votre transformation numérique.`;
  const url = `${appUrl}/contact`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName,
      locale: 'fr_CA',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const businessHours = parseBusinessHours(settings.businessHours);

  // Build address parts from SiteSettings
  const addressParts: string[] = [];
  if (settings.address) addressParts.push(settings.address);
  const cityLine = [settings.city, settings.province].filter(Boolean).join(', ');
  if (cityLine) addressParts.push(cityLine);
  if (settings.postalCode) addressParts.push(settings.postalCode);
  if (settings.country) addressParts.push(settings.country);

  // Build email list
  const emails: string[] = [];
  if (settings.supportEmail) emails.push(settings.supportEmail);
  if (settings.email && settings.email !== settings.supportEmail) emails.push(settings.email);

  return (
    <ContactPageClient
      companyName={settings.companyName}
      addressParts={addressParts}
      emails={emails}
      phone={settings.phone}
      businessHours={businessHours}
    />
  );
}
