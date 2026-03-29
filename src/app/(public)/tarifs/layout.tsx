import type { Metadata } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

export const metadata: Metadata = {
  title: 'Tarifs et forfaits | Attitudes VIP — Koraline',
  description: 'Découvrez nos forfaits adaptés à chaque entreprise. Essai gratuit, sans engagement. Plans à partir de 29$/mois.',
  alternates: {
    canonical: `${APP_URL}/tarifs`,
  },
  openGraph: {
    title: 'Tarifs et forfaits | Attitudes VIP — Koraline',
    description: 'Découvrez nos forfaits adaptés à chaque entreprise. Essai gratuit, sans engagement. Plans à partir de 29$/mois.',
    url: `${APP_URL}/tarifs`,
    siteName: 'Attitudes VIP — Koraline',
    type: 'website',
    locale: 'fr_CA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tarifs et forfaits | Attitudes VIP — Koraline',
    description: 'Découvrez nos forfaits adaptés à chaque entreprise. Essai gratuit, sans engagement. Plans à partir de 29$/mois.',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Est-ce qu\'il y a un essai gratuit?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Oui, le plan Pro inclut un essai gratuit de 14 jours, sans carte de crédit requise. Le plan Gratuit est également disponible sans limite de durée.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quel est le prix de départ?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Les plans individuels débutent à 29$/mois (plan Pro). Un plan Gratuit est aussi disponible avec 5 formations incluses.',
      },
    },
    {
      '@type': 'Question',
      name: 'Y a-t-il un engagement de durée?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Non, il n\'y a aucun engagement. Vous pouvez annuler à tout moment. Le plan annuel offre une économie de 30% par rapport au mensuel.',
      },
    },
    {
      '@type': 'Question',
      name: 'Quels forfaits sont disponibles pour les entreprises?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nous offrons trois plans entreprise: Starter (499$/mois, jusqu\'à 25 employés), Business (1 499$/mois, jusqu\'à 100 employés), et Enterprise (prix sur mesure, employés illimités avec SLA garanti).',
      },
    },
    {
      '@type': 'Question',
      name: 'Comment contacter l\'équipe pour un plan Enterprise?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Pour un plan Enterprise ou un devis personnalisé, contactez-nous via la page /contact ou demandez une démonstration via /demo. Notre équipe vous répondra dans les 24 heures.',
      },
    },
  ],
};

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {children}
    </>
  );
}
