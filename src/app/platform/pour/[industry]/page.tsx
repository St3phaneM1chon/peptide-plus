import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/* -------------------------------------------------------------------------- */
/*  Industry Data                                                             */
/* -------------------------------------------------------------------------- */

const industries = {
  ecommerce: {
    title: 'Pour les boutiques en ligne',
    subtitle:
      "Tout ce qu'il faut pour vendre en ligne, gerer vos clients et suivre votre comptabilite",
    features: ['Commerce', 'CRM', 'Marketing', 'Comptabilite'],
    pain: 'Vous jonglez entre Shopify, Mailchimp, QuickBooks et un CRM?',
    painDetail:
      "Chaque outil a son abonnement, ses mises a jour, ses integrations fragiles. Vous passez plus de temps a connecter vos outils qu'a developper votre business.",
    solution: 'Koraline remplace 4+ outils par une seule plateforme integree.',
    solutionDetail:
      "Catalogue, paiements Stripe, emails marketing, CRM et comptabilite — tout communique nativement. Une seule interface, une seule facture.",
    savings: '500$/mois en moyenne',
    heroColor: 'from-blue-50 via-white to-white',
    iconBg: 'bg-blue-50 text-[#0066CC]',
    modules: [
      { name: 'Commerce complet', desc: 'Catalogue, inventaire, commandes, paiements Stripe, livraison, bundles' },
      { name: 'Marketing integre', desc: 'Campagnes courriel, codes promo, SEO, blog, ambassadeurs' },
      { name: 'CRM natif', desc: 'Pipeline de ventes, leads, deals, suivi activites, segmentation' },
      { name: 'Comptabilite', desc: "Journal d'ecritures, plan comptable, TVQ/TPS, rapports financiers" },
    ],
  },
  services: {
    title: 'Pour les entreprises de services',
    subtitle:
      'Gerez vos clients, suivez vos projets et facturez — sans empiler les outils',
    features: ['CRM', 'Comptabilite', 'Communications', 'Marketing'],
    pain: 'Vos dossiers clients sont eparpilles entre emails, tableurs et logiciels?',
    painDetail:
      "Chaque client a son historique dans un outil different. Les rendez-vous sont dans Google Calendar, les factures dans QuickBooks, les notes dans un fichier Word. Impossible d'avoir une vue complete.",
    solution:
      "Koraline centralise tout: CRM, facturation, communications et suivi — dans un seul endroit.",
    solutionDetail:
      "Fiche client complete, historique de communications, factures automatisees, pipeline de projets. Vos employes accedent a tout depuis la meme interface.",
    savings: '350$/mois en moyenne',
    heroColor: 'from-emerald-50 via-white to-white',
    iconBg: 'bg-emerald-50 text-emerald-600',
    modules: [
      { name: 'CRM complet', desc: 'Pipeline, leads, deals, activites, segmentation, fiches client' },
      { name: 'Comptabilite integree', desc: 'Facturation, ecritures, plan comptable, TVQ/TPS, rapports' },
      { name: 'Communications', desc: 'Telephonie VoIP, chat en direct, tickets support, emails' },
      { name: 'Marketing', desc: 'Campagnes courriel, newsletter, reputation, ambassadeurs' },
    ],
  },
  coaching: {
    title: 'Pour les coachs et consultants',
    subtitle:
      'Gerez votre pratique, fidilisez vos clients et automatisez votre admin',
    features: ['CRM', 'LMS', 'Marketing', 'Comptabilite'],
    pain: 'Vous passez plus de temps sur votre admin que sur vos clients?',
    painDetail:
      "Entre la prise de rendez-vous, le suivi client, la facturation et le marketing, vous consacrez 40% de votre semaine a des taches administratives au lieu de coacher.",
    solution:
      "Koraline automatise votre admin et vous donne les outils pour scaler.",
    solutionDetail:
      "Formation en ligne (LMS), CRM personnalise, facturation automatique, campagnes marketing — tout est connecte. Vous vous concentrez sur ce que vous faites de mieux.",
    savings: '400$/mois en moyenne',
    heroColor: 'from-violet-50 via-white to-white',
    iconBg: 'bg-violet-50 text-violet-600',
    modules: [
      { name: 'LMS Formation', desc: 'Cours en ligne, quiz, progression, certificats, contenu video' },
      { name: 'CRM client', desc: 'Fiches client, historique, suivi, segmentation, notes' },
      { name: 'Marketing', desc: 'Email sequences, landing pages, newsletter, ambassadeurs' },
      { name: 'Comptabilite', desc: 'Facturation automatisee, TVQ/TPS, rapports, conciliation' },
    ],
  },
  formation: {
    title: 'Pour les organismes de formation',
    subtitle:
      'Creez, vendez et gerez vos formations en ligne avec un LMS professionnel integre',
    features: ['LMS', 'Commerce', 'Marketing', 'CRM'],
    pain: 'Votre LMS, votre site web et votre systeme de paiement ne se parlent pas?',
    painDetail:
      "Teachable pour les cours, Stripe pour les paiements, Mailchimp pour le marketing, un tableur pour le suivi. Chaque etudiant inscrit genere 4 operations manuelles.",
    solution:
      "Koraline integre le LMS, le commerce et le marketing en une seule plateforme.",
    solutionDetail:
      "Vos etudiants achetent, s'inscrivent et progressent dans un seul parcours. Suivi automatique, certificats, emails de relance, tout est natif.",
    savings: '600$/mois en moyenne',
    heroColor: 'from-amber-50 via-white to-white',
    iconBg: 'bg-amber-50 text-amber-600',
    modules: [
      { name: 'LMS avance', desc: 'Cours, modules, quiz adaptatifs, video, FSRS, certificats, gamification' },
      { name: 'Commerce', desc: 'Vente de formations, abonnements, bundles, codes promo' },
      { name: 'Marketing', desc: 'Sequences email, relances automatiques, blog, SEO' },
      { name: 'CRM etudiants', desc: 'Progression, segmentation, fiches, historique, notes' },
    ],
  },
  b2b: {
    title: 'Pour les entreprises B2B',
    subtitle:
      'Pipeline de ventes, comptabilite et communications — unifies pour votre equipe',
    features: ['CRM', 'Comptabilite', 'Communications', 'Commerce'],
    pain: 'Votre equipe de vente utilise HubSpot, votre comptable utilise Sage, et personne ne se parle?',
    painDetail:
      "Les donnees de ventes ne sont jamais a jour dans la comptabilite. Les suivis clients tombent entre les craques. Les rapports prennent des heures a compiler parce que les sources sont differentes.",
    solution:
      "Koraline unifie ventes, comptabilite et communications pour que votre equipe travaille sur les memes donnees.",
    solutionDetail:
      "Pipeline CRM connecte a la facturation, telephonie VoIP integree, tableau de bord unifie. Chaque deal se transforme automatiquement en facture. Chaque appel est logue dans le CRM.",
    savings: '700$/mois en moyenne',
    heroColor: 'from-slate-50 via-white to-white',
    iconBg: 'bg-slate-100 text-slate-600',
    modules: [
      { name: 'CRM Pipeline', desc: 'Leads, deals, pipeline, activites, previsions, segmentation' },
      { name: 'Comptabilite', desc: 'Facturation B2B, ecritures, plan comptable, rapports, exportation' },
      { name: 'Communications', desc: 'Telephonie VoIP, appels loges dans CRM, chat, tickets' },
      { name: 'Commerce B2B', desc: 'Catalogue, tarification client, commandes, abonnements' },
    ],
  },
} as const;

type IndustryKey = keyof typeof industries;

/* -------------------------------------------------------------------------- */
/*  Static Params                                                             */
/* -------------------------------------------------------------------------- */

export function generateStaticParams() {
  return Object.keys(industries).map((key) => ({ industry: key }));
}

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                  */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ industry: string }>;
}): Promise<Metadata> {
  const { industry: slug } = await params;
  const data = industries[slug as IndustryKey];
  if (!data) return { title: 'Koraline' };

  return {
    title: `${data.title} — Suite Koraline | Attitudes VIP`,
    description: data.subtitle,
    openGraph: {
      title: `${data.title} — Suite Koraline`,
      description: data.subtitle,
      url: `https://attitudes.vip/platform/pour/${slug}`,
      type: 'website',
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-[#0066CC] mt-0.5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function PainIcon() {
  return (
    <svg
      className="w-8 h-8 text-red-500"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}

function SolutionIcon() {
  return (
    <svg
      className="w-8 h-8 text-green-500"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ industry: string }>;
}) {
  const { industry: slug } = await params;
  const data = industries[slug as IndustryKey];
  if (!data) notFound();

  return (
    <>
      {/* ================================================================ */}
      {/* HERO                                                             */}
      {/* ================================================================ */}
      <section className={`relative overflow-hidden bg-gradient-to-b ${data.heroColor}`}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-br from-[#0066CC]/8 to-[#003366]/4 rounded-full blur-3xl -z-10" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          {/* Feature badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {data.features.map((f) => (
              <span
                key={f}
                className="inline-flex items-center px-3 py-1 bg-white/80 backdrop-blur-sm text-xs font-semibold text-gray-600 rounded-full border border-gray-200"
              >
                {f}
              </span>
            ))}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
            {data.title}
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            {data.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#0066CC] text-white font-semibold rounded-full hover:bg-[#0052A3] transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-200 text-base"
            >
              Reserver une demo
              <ArrowRightIcon />
            </Link>
            <Link
              href="/platform/calculateur-roi"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-700 font-semibold rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-base"
            >
              Calculer mes economies
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PAIN POINT                                                       */}
      {/* ================================================================ */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Pain */}
            <div className="bg-red-50/50 rounded-2xl border border-red-100 p-8">
              <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-6">
                <PainIcon />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">Le probleme</h2>
              <p className="text-lg font-medium text-red-700 mb-4">{data.pain}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{data.painDetail}</p>
            </div>

            {/* Solution */}
            <div className="bg-green-50/50 rounded-2xl border border-green-100 p-8">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-6">
                <SolutionIcon />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">La solution Koraline</h2>
              <p className="text-lg font-medium text-green-700 mb-4">{data.solution}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{data.solutionDetail}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* MODULES HIGHLIGHTED                                              */}
      {/* ================================================================ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Les modules qui font la difference
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Tout ce dont votre entreprise a besoin, integre nativement.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {data.modules.map((mod) => (
              <div
                key={mod.name}
                className="group bg-white rounded-2xl border border-gray-100 p-8 hover:border-[#0066CC]/20 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300"
              >
                <div className={`w-12 h-12 ${data.iconBg} rounded-xl flex items-center justify-center mb-5`}>
                  <CheckIcon />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{mod.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* ROI TEASER                                                       */}
      {/* ================================================================ */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-[#003366] to-[#0066CC] rounded-3xl p-10 sm:p-14 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Economisez {data.savings}
            </h2>
            <p className="text-lg text-blue-200 mb-8 max-w-xl mx-auto">
              En remplacant vos outils actuels par Koraline, vous economisez en
              moyenne {data.savings} — et vous gagnez des heures chaque semaine.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/platform/calculateur-roi"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-[#003366] font-semibold rounded-full hover:bg-blue-50 transition-colors text-base"
              >
                Calculer mon ROI
                <ArrowRightIcon />
              </Link>
              <Link
                href="/platform/comparer"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/10 text-white font-semibold rounded-full hover:bg-white/20 transition-colors text-base border border-white/20"
              >
                Comparer les outils
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CTA FINAL                                                        */}
      {/* ================================================================ */}
      <section className="py-24 bg-[#003366]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pret a simplifier votre entreprise?
          </h2>
          <p className="text-lg text-blue-200 mb-10 max-w-xl mx-auto">
            Decouvrez comment Koraline peut transformer la gestion de votre entreprise
            en une seule plateforme.
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
        </div>
      </section>
    </>
  );
}
