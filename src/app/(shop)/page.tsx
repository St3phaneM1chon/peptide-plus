import { Metadata } from 'next';
import HomePageClient from './HomePageClient';

export const metadata: Metadata = {
  title: 'BioCycle Peptides - Premium Research Peptides Canada',
  description:
    "Canada's trusted source for premium research peptides. Lab-tested, 99%+ purity, fast shipping. Shop BPC-157, TB-500, Semaglutide and more.",
  alternates: {
    canonical: 'https://biocyclepeptides.com',
  },
  openGraph: {
    title: 'BioCycle Peptides - Premium Research Peptides Canada',
    description:
      "Canada's trusted source for premium research peptides. Lab-tested, 99%+ purity, fast shipping.",
    url: 'https://biocyclepeptides.com',
    type: 'website',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
