import { Metadata } from 'next';
import Link from 'next/link';
import { KORALINE_PLANS, KORALINE_MODULES, KORALINE_LICENSES } from '@/lib/stripe-attitudes';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  organizationSchema,
  softwareApplicationSchema,
  faqSchema,
} from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Suite Koraline — Votre boutique en ligne, cle en main | Attitudes VIP',
  description:
    'Lancez votre boutique en ligne avec Koraline. Commerce, CRM, comptabilite, marketing, communications et IA — tout inclus. A partir de 149$/mois. Fait au Quebec.',
  openGraph: {
    title: 'Suite Koraline — Votre boutique en ligne, cle en main',
    description:
      'Lancez votre boutique en ligne avec Koraline. Commerce, CRM, comptabilite, marketing, communications et IA — tout inclus.',
    url: 'https://attitudes.vip',
    type: 'website',
  },
};

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

const FEATURES = [
  {
    title: 'Commerce',
    slug: 'commerce',
    description:
      'Catalogue, inventaire, commandes, paiements Stripe, livraison, bundles, abonnements. Tout ce qu\'il faut pour vendre.',
    icon: FeatureIconShop,
  },
  {
    title: 'CRM',
    slug: 'crm',
    description:
      'Gestion clients, pipeline de ventes, leads, deals, suivi d\'activites, segmentation avancee.',
    icon: FeatureIconCRM,
  },
  {
    title: 'Comptabilite',
    slug: 'comptabilite',
    description:
      'Journal d\'ecritures, plan comptable, rapports financiers, TVQ/TPS, conciliation, exportation comptable.',
    icon: FeatureIconAccounting,
  },
  {
    title: 'Marketing',
    slug: 'marketing',
    description:
      'Campagnes courriel, newsletter, codes promo, SEO integre, blog, reseaux sociaux, ambassadeurs.',
    icon: FeatureIconMarketing,
  },
  {
    title: 'Communications',
    slug: 'telephonie',
    description:
      'Telephonie VoIP, chat en direct, tickets support, emails transactionnels, notifications push.',
    icon: FeatureIconComms,
  },
  {
    title: 'IA Aurelia',
    slug: 'ia',
    description:
      'Assistante IA integree: redaction, analyse, suggestions, automatisation, support client intelligent.',
    icon: FeatureIconAI,
  },
];

const INTEGRATIONS_PREVIEW = [
  {
    title: 'De l\'achat a la comptabilite',
    description:
      'Un client passe commande. Le CRM se met a jour, la facture est generee et l\'ecriture comptable est enregistree — automatiquement.',
    steps: ['Commerce', 'CRM', 'Comptabilite'],
    icon: '🛒',
  },
  {
    title: 'Du lead au client fidele',
    description:
      'Un prospect remplit un formulaire. Le CRM cree le lead, le marketing envoie une sequence, et le programme de fidelite s\'active apres le premier achat.',
    steps: ['Marketing', 'CRM', 'Fidelite'],
    icon: '🤝',
  },
  {
    title: 'Du ticket a la resolution',
    description:
      'Un client envoie un message. Aurelia analyse le probleme, le ticket est cree, l\'equipe est notifiee par VoIP — historique complet dans le CRM.',
    steps: ['Communications', 'IA', 'CRM'],
    icon: '🎧',
  },
];

const INDUSTRIES = [
  {
    slug: 'ecommerce',
    title: 'Boutiques en ligne',
    tagline: 'Commerce, CRM, marketing et comptabilite — tout integre pour vendre en ligne.',
    icon: '🛍️',
  },
  {
    slug: 'services',
    title: 'Entreprises de services',
    tagline: 'Gerez vos clients, facturez et communiquez depuis une seule plateforme.',
    icon: '💼',
  },
  {
    slug: 'coaching',
    title: 'Coachs et consultants',
    tagline: 'Automatisez votre admin, vendez vos formations et fidelisez vos clients.',
    icon: '🎯',
  },
  {
    slug: 'formation',
    title: 'Organismes de formation',
    tagline: 'LMS professionnel, vente de cours en ligne et suivi des apprenants.',
    icon: '🎓',
  },
  {
    slug: 'b2b',
    title: 'Entreprises B2B',
    tagline: 'Pipeline de ventes, telephonie VoIP et comptabilite unifies pour votre equipe.',
    icon: '🏢',
  },
];

const STEPS = [
  {
    step: '1',
    title: 'Choisissez votre plan',
    description: 'Essentiel, Pro ou Enterprise. Ajoutez des modules optionnels selon vos besoins.',
  },
  {
    step: '2',
    title: 'Configurez votre boutique',
    description: 'Domaine personnalise, branding, catalogue produits, methodes de paiement. En 30 minutes.',
  },
  {
    step: '3',
    title: 'Vendez partout',
    description: 'Votre boutique est en ligne. Commerce, CRM, comptabilite — tout fonctionne ensemble.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'Est-ce que je peux essayer avant de payer?',
    a: 'Nous n\'offrons pas d\'essai gratuit, mais vous pouvez reserver une demo personnalisee avec notre equipe. Nous vous montrerons la plateforme en action avec vos propres cas d\'usage.',
  },
  {
    q: 'Puis-je changer de plan plus tard?',
    a: 'Oui, vous pouvez passer a un plan superieur a tout moment. La difference de prix est proratisee. Vous pouvez egalement ajouter ou retirer des modules optionnels chaque mois.',
  },
  {
    q: 'Combien de produits puis-je ajouter?',
    a: 'Tous les plans incluent un nombre illimite de produits, categories, et variantes. Il n\'y a pas de limite artificielle sur le catalogue.',
  },
  {
    q: 'Est-ce que je peux utiliser mon propre domaine?',
    a: 'Oui. Chaque plan inclut un domaine personnalise (votre-marque.com). Nous gerons la configuration DNS pour vous. Vous obtenez aussi un sous-domaine gratuit (votre-marque.koraline.app).',
  },
  {
    q: 'Quelles methodes de paiement sont supportees?',
    a: 'Stripe est integre par defaut (Visa, Mastercard, American Express). PayPal est disponible. D\'autres processeurs de paiement peuvent etre configures sur demande.',
  },
  {
    q: 'Y a-t-il des frais de transaction?',
    a: 'Koraline ne prend aucune commission sur vos ventes. Vous payez uniquement les frais standards de votre processeur de paiement (Stripe: 2.9% + 30c par transaction).',
  },
  {
    q: 'La plateforme est-elle bilingue?',
    a: 'Oui. Koraline supporte 22 langues nativement. L\'interface d\'administration et la boutique client sont entierement traduites. Le francais et l\'anglais sont les langues principales.',
  },
  {
    q: 'Comment fonctionne le support?',
    a: 'Support par courriel et chat en direct, en francais et en anglais. Les plans Enterprise beneficient d\'un support prioritaire avec temps de reponse garanti.',
  },
];

/* -------------------------------------------------------------------------- */
/*  SVG Icons                                                                 */
/* -------------------------------------------------------------------------- */

function FeatureIconShop() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  );
}

function FeatureIconCRM() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function FeatureIconAccounting() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm2.498-6h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007v-.008Zm2.504-6h.006v.008h-.006v-.008Zm0 2.25h.006v.008h-.006v-.008Zm0 2.25h.006v.008h-.006v-.008Zm0 2.25h.006v.008h-.006v-.008Zm2.505-6h.005v.008h-.005v-.008Zm0 2.25h.005v.008h-.005v-.008Zm0 2.25h.005v.008h-.005v-.008ZM15.75 18.75h.008v.008h-.008v-.008Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  );
}

function FeatureIconMarketing() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46" />
    </svg>
  );
}

function FeatureIconComms() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  );
}

function FeatureIconAI() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-[#0066CC] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function PlatformLandingPage() {
  const plans = Object.entries(KORALINE_PLANS) as [string, (typeof KORALINE_PLANS)[keyof typeof KORALINE_PLANS]][];
  const modules = Object.entries(KORALINE_MODULES) as [string, (typeof KORALINE_MODULES)[keyof typeof KORALINE_MODULES]][];
  const licenses = Object.entries(KORALINE_LICENSES) as [string, (typeof KORALINE_LICENSES)[keyof typeof KORALINE_LICENSES]][];

  return (
    <>
      {/* Schema.org Structured Data */}
      <JsonLd
        data={softwareApplicationSchema({
          name: 'Suite Koraline',
          description:
            'Plateforme SaaS tout-en-un pour PME : commerce, CRM, comptabilite, marketing, telephonie, formation et IA. A partir de 149$/mois.',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          offers: { price: 149, priceCurrency: 'CAD' },
          featureList: [
            'Commerce en ligne',
            'CRM',
            'Comptabilite',
            'Marketing',
            'Telephonie VoIP',
            'Formation LMS',
            'IA Aurelia',
            'Emails',
            'Medias',
            'Fidelite',
            'Communaute',
          ],
        })}
      />
      <JsonLd data={organizationSchema()} />
      <JsonLd
        data={faqSchema(
          FAQ_ITEMS.map((item) => ({ question: item.q, answer: item.a }))
        )}
      />

      {/* ================================================================== */}
      {/* HERO                                                               */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-br from-[#0066CC]/8 to-[#003366]/4 rounded-full blur-3xl -z-10" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-[#0066CC] text-xs font-semibold rounded-full mb-8 uppercase tracking-wider">
            Nouveau — Suite Koraline 2026
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
            Votre boutique en ligne,{' '}
            <span className="text-[#0066CC]">cle en main</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Commerce, CRM, comptabilite, marketing, communications et IA — tout ce
            dont votre entreprise a besoin, dans une seule plateforme. A partir de 149$/mois.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#0066CC] text-white font-semibold rounded-full hover:bg-[#0052A3] transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-200 text-base"
            >
              Reserver une demo
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-700 font-semibold rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-base"
            >
              Voir les plans
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* TRUST BAR                                                          */}
      {/* ================================================================== */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-gray-500 font-medium">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
              Fait au Quebec
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#0066CC]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>
              22 langues
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#0066CC]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>
              Support bilingue FR/EN
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
              Paiements securises
            </span>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* KEY STATS                                                          */}
      {/* ================================================================== */}
      <section className="py-14 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '500+', label: 'Entreprises en croissance' },
              { value: '22', label: 'Langues supportees' },
              { value: '99.9%', label: 'Disponibilite' },
              { value: '11', label: 'Modules integres' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#0066CC] mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FEATURES                                                           */}
      {/* ================================================================== */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Tout pour votre entreprise, au meme endroit
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Six modules integres qui fonctionnent ensemble. Pas de patchwork, pas d&apos;integrations fragiles.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link
                  key={feature.title}
                  href={`/platform/features/${feature.slug}`}
                  className="group relative p-8 bg-white rounded-2xl border border-gray-100 hover:border-[#0066CC]/20 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-blue-50 text-[#0066CC] rounded-xl flex items-center justify-center mb-5 group-hover:bg-[#0066CC] group-hover:text-white transition-colors duration-300">
                    <Icon />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{feature.description}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0066CC] group-hover:gap-2 transition-all">
                    En savoir plus
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* HOW IT WORKS                                                       */}
      {/* ================================================================== */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Lancez-vous en 3 etapes
            </h2>
            <p className="text-lg text-gray-500">
              De l&apos;inscription a la premiere vente, en moins d&apos;une journee.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 bg-[#0066CC] text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-5">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* INTEGRATIONS                                                       */}
      {/* ================================================================== */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Comment tout fonctionne ensemble
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Vos modules communiquent nativement. Les donnees circulent automatiquement — sans integrations a configurer.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {INTEGRATIONS_PREVIEW.map((workflow) => (
              <div
                key={workflow.title}
                className="relative p-8 bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300"
              >
                <div className="text-3xl mb-4">{workflow.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{workflow.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{workflow.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {workflow.steps.map((step, i) => (
                    <span key={step} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#0066CC] bg-blue-50 px-2.5 py-1 rounded-full">
                        {step}
                      </span>
                      {i < workflow.steps.length - 1 && (
                        <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link
              href="/platform/integrations"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-full hover:bg-gray-200 transition-colors text-sm"
            >
              Voir toutes les integrations
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* SOCIAL PROOF — Ils nous font confiance                             */}
      {/* ================================================================== */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Ils nous font confiance
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Des entrepreneurs et PME du Quebec qui ont transforme leur activite avec Koraline.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Testimonial 1 */}
            <div className="flex flex-col p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:shadow-blue-50 transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-sm text-gray-600 leading-relaxed mb-6 flex-1">
                &laquo;&nbsp;On gerait notre boutique, notre comptabilite et notre CRM avec trois outils differents. Depuis Koraline, tout est au meme endroit. On a gagne un temps fou et notre chiffre d&apos;affaires a suivi.&nbsp;&raquo;
              </blockquote>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#0066CC] text-white flex items-center justify-center text-sm font-bold shrink-0">
                  ML
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Marie-Eve Lavoie</div>
                  <div className="text-xs text-gray-500">Fondatrice, Atelier Nordique</div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <div className="text-xl font-bold text-[#0066CC]">+40%</div>
                <div className="text-xs text-gray-500">Revenu en 6 mois</div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="flex flex-col p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:shadow-blue-50 transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-sm text-gray-600 leading-relaxed mb-6 flex-1">
                &laquo;&nbsp;L&apos;integration comptabilite-commerce est incroyable. Chaque vente genere automatiquement les ecritures. Mon comptable adore — et moi je ne passe plus mes vendredis soir a reconcilier des chiffres.&nbsp;&raquo;
              </blockquote>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#003366] text-white flex items-center justify-center text-sm font-bold shrink-0">
                  JF
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Jean-Francois Tremblay</div>
                  <div className="text-xs text-gray-500">Directeur general, Distribution JFT</div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <div className="text-xl font-bold text-[#0066CC]">-50%</div>
                <div className="text-xs text-gray-500">Temps d&apos;administration</div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="flex flex-col p-8 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:shadow-blue-50 transition-all duration-300">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-sm text-gray-600 leading-relaxed mb-6 flex-1">
                &laquo;&nbsp;Je cherchais une plateforme bilingue avec un vrai LMS pour vendre mes formations. Koraline fait tout ca — plus le CRM, les courriels et meme la telephonie. C&apos;est le couteau suisse que j&apos;attendais.&nbsp;&raquo;
              </blockquote>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  SB
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Sarah Bouchard</div>
                  <div className="text-xs text-gray-500">Coach certifiee, Equilibre Pro</div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <div className="text-xl font-bold text-[#0066CC]">3x</div>
                <div className="text-xs text-gray-500">Plus de ventes de formations</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* PRICING                                                            */}
      {/* ================================================================== */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Un prix clair, sans surprise
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Choisissez le plan qui correspond a votre entreprise. Ajoutez des modules
              au besoin. Aucune commission sur vos ventes.
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {plans.map(([key, plan], index) => {
              const isPro = key === 'pro';
              return (
                <div
                  key={key}
                  className={`relative rounded-2xl border p-8 flex flex-col ${
                    isPro
                      ? 'border-[#0066CC] bg-white shadow-xl shadow-blue-100 ring-1 ring-[#0066CC]/10 scale-[1.02]'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0066CC] text-white text-xs font-bold rounded-full uppercase tracking-wider">
                      Populaire
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mb-6">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-extrabold text-gray-900">
                      {(plan.monthlyPrice / 100).toFixed(0)}$
                    </span>
                    <span className="text-gray-500 text-sm font-medium"> CAD/mois</span>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <CheckIcon />
                        {feature}
                      </li>
                    ))}
                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckIcon />
                      {plan.includedEmployees === 0
                        ? '1 licence proprietaire incluse'
                        : `1 proprio + ${plan.includedEmployees} employes inclus`}
                    </li>
                  </ul>
                  <Link
                    href={index === 2 ? "/demo" : `/signup?plan=${key}`}
                    className={`block w-full text-center py-3 rounded-full font-semibold text-sm transition-all ${
                      isPro
                        ? 'bg-[#0066CC] text-white hover:bg-[#0052A3] shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {index === 2 ? 'Nous contacter' : 'Commencer maintenant'}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* ================================================================== */}
          {/* MODULES                                                            */}
          {/* ================================================================== */}
          <div id="modules" className="mb-20">
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Modules optionnels
              </h3>
              <p className="text-gray-500">
                Ajoutez des fonctionnalites specifiques a votre plan. Activez ou desactivez chaque mois.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {modules.map(([, mod]) => (
                <div
                  key={mod.name}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{mod.name}</span>
                  <span className="text-sm font-semibold text-[#0066CC]">
                    {(mod.monthlyPrice / 100).toFixed(0)}$/mo
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ================================================================== */}
          {/* LICENSES                                                           */}
          {/* ================================================================== */}
          <div className="mb-6">
            <div className="text-center mb-10">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Licences employes
              </h3>
              <p className="text-gray-500">
                Chaque plan inclut la licence proprietaire. Ajoutez des employes selon vos besoins.
              </p>
            </div>
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm font-semibold text-gray-500">
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4 text-right">Prix/mois</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">Proprietaire</span>
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Inclus</span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-500">Inclus dans le plan</td>
                  </tr>
                  {licenses.map(([, license]) => (
                    <tr key={license.name}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{license.name}</td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                        {(license.monthlyPrice / 100).toFixed(0)}$/mois
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* INDUSTRIES                                                         */}
      {/* ================================================================== */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Pour chaque type d&apos;entreprise
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Que vous vendiez des produits, des services ou des formations, Koraline s&apos;adapte a votre realite.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {INDUSTRIES.map((industry) => (
              <Link
                key={industry.slug}
                href={`/platform/pour/${industry.slug}`}
                className="group p-6 bg-white rounded-2xl border border-gray-100 hover:border-[#0066CC]/20 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300"
              >
                <div className="text-3xl mb-4">{industry.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-[#0066CC] transition-colors">
                  {industry.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{industry.tagline}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#0066CC] group-hover:gap-2 transition-all">
                  Decouvrir
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* FAQ                                                                */}
      {/* ================================================================== */}
      <section className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Questions frequentes
            </h2>
          </div>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item, i) => (
              <details key={i} className="group bg-white rounded-xl border border-gray-100 overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none text-sm font-semibold text-gray-900 hover:text-[#0066CC] transition-colors">
                  {item.q}
                  <ChevronIcon />
                </summary>
                <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA FINAL                                                          */}
      {/* ================================================================== */}
      <section className="py-24 bg-[#003366]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pret a lancer votre boutique?
          </h2>
          <p className="text-lg text-blue-200 mb-10 max-w-xl mx-auto">
            Rejoignez les entreprises quebecoises qui font confiance a Koraline
            pour leur commerce en ligne.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-[#003366] font-semibold rounded-full hover:bg-blue-50 transition-colors text-base"
            >
              Reserver une demo
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#0066CC] text-white font-semibold rounded-full hover:bg-[#0052A3] transition-colors text-base border border-white/10"
            >
              Commencer maintenant
            </Link>
          </div>
          <p className="text-xs text-blue-300 mt-6">
            Pas d&apos;essai gratuit. Pas de frais caches. Pas de commission sur vos ventes.
          </p>
        </div>
      </section>
    </>
  );
}
