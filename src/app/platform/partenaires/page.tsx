import { Metadata } from 'next';
import Link from 'next/link';

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                  */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Devenez partenaire Koraline — Programme de partenariat | Attitudes VIP',
  description:
    'Rejoignez le programme de partenariat Koraline. Referral, Revendeur ou Agence — gagnez des commissions et developpez votre business.',
  openGraph: {
    title: 'Devenez partenaire Koraline',
    description:
      'Rejoignez le programme de partenariat Koraline. Referral, Revendeur ou Agence.',
    url: 'https://attitudes.vip/platform/partenaires',
    type: 'website',
  },
};

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

const partnerTiers = [
  {
    name: 'Referral',
    subtitle: 'Recommandez et gagnez',
    description:
      'Recommandez Koraline a votre reseau et recevez une commission pour chaque client qui s\'inscrit.',
    commission: '15%',
    commissionLabel: 'commission recurrente',
    benefits: [
      'Lien de referral personnalise',
      '15% de commission recurrente (12 mois)',
      'Dashboard de suivi en temps reel',
      'Paiements mensuels automatiques',
      'Support prioritaire pour vos referrals',
      'Aucun engagement minimum',
    ],
    ideal: 'Consultants, comptables, freelances',
    color: 'border-blue-200 bg-blue-50/30',
    iconBg: 'bg-blue-100 text-[#0066CC]',
    badgeBg: 'bg-blue-100 text-[#0066CC]',
  },
  {
    name: 'Revendeur',
    subtitle: 'Revendez avec marge',
    description:
      'Integrez Koraline a vos offres de services. Achetez a prix reduit et fixez votre propre tarification.',
    commission: '25%',
    commissionLabel: 'marge sur chaque vente',
    benefits: [
      'Tout Referral +',
      '25% de marge sur chaque licence',
      'Tarification personnalisee pour vos clients',
      'Co-branding avec votre logo',
      'Onboarding assiste pour vos clients',
      'Gestionnaire de compte dedie',
      'Formation produit approfondie',
      'Priorite sur les nouvelles fonctionnalites',
    ],
    ideal: 'Agences web, integrateurs, ESN',
    color: 'border-[#0066CC] bg-white shadow-xl shadow-blue-100 ring-1 ring-[#0066CC]/10 scale-[1.02]',
    iconBg: 'bg-[#0066CC] text-white',
    badgeBg: 'bg-[#0066CC] text-white',
  },
  {
    name: 'Agence',
    subtitle: 'White-label complet',
    description:
      'Deployer Koraline sous votre propre marque. Votre nom, votre logo, votre domaine. Nous gerons la plateforme.',
    commission: '40%',
    commissionLabel: 'marge white-label',
    benefits: [
      'Tout Revendeur +',
      'White-label complet (votre marque)',
      'Domaine personnalise (votre-marque.com)',
      'Branding integral (logo, couleurs, emails)',
      'API d\'administration avancee',
      'Support technique niveau 2',
      'SLA garanti 99.9%',
      'Roadmap collaborative',
      'Comite consultatif partenaires',
    ],
    ideal: 'Grandes agences, firmes SaaS, revendeurs de logiciels',
    color: 'border-gray-200 bg-gray-50/30',
    iconBg: 'bg-gray-100 text-gray-700',
    badgeBg: 'bg-gray-100 text-gray-700',
  },
];

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-[#0066CC] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
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

export default function PartnersPage() {
  return (
    <>
      {/* ================================================================ */}
      {/* HERO                                                             */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-br from-[#0066CC]/8 to-[#003366]/4 rounded-full blur-3xl -z-10" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-[#0066CC] text-xs font-semibold rounded-full mb-8 uppercase tracking-wider">
            Programme partenaires
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
            Devenez partenaire{' '}
            <span className="text-[#0066CC]">Koraline</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Gagnez des revenus recurrents en recommandant ou revendant la suite
            tout-en-un preferee des entreprises quebecoises.
          </p>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PARTNER TIERS                                                    */}
      {/* ================================================================ */}
      <section className="pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {partnerTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-8 flex flex-col ${tier.color}`}
              >
                {tier.name === 'Revendeur' && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0066CC] text-white text-xs font-bold rounded-full uppercase tracking-wider">
                    Populaire
                  </div>
                )}

                {/* Header */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${tier.iconBg}`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-1">{tier.name}</h3>
                <p className="text-sm font-medium text-[#0066CC] mb-3">{tier.subtitle}</p>
                <p className="text-sm text-gray-500 mb-6">{tier.description}</p>

                {/* Commission */}
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">{tier.commission}</span>
                  <span className="text-sm text-gray-500 ml-1">{tier.commissionLabel}</span>
                </div>

                {/* Benefits */}
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckIcon />
                      {benefit}
                    </li>
                  ))}
                </ul>

                {/* Ideal for */}
                <div className="mb-6">
                  <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${tier.badgeBg}`}>
                    Ideal pour: {tier.ideal}
                  </span>
                </div>

                {/* CTA */}
                <Link
                  href="/contact"
                  className={`block w-full text-center py-3 rounded-full font-semibold text-sm transition-all ${
                    tier.name === 'Revendeur'
                      ? 'bg-[#0066CC] text-white hover:bg-[#0052A3] shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Devenir partenaire {tier.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* HOW IT WORKS                                                     */}
      {/* ================================================================ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Comment ca fonctionne
            </h2>
            <p className="text-lg text-gray-500">
              3 etapes simples pour commencer a generer des revenus.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Inscrivez-vous',
                desc: 'Remplissez le formulaire. Notre equipe valide votre profil en 24-48h.',
              },
              {
                step: '2',
                title: 'Recommandez ou revendez',
                desc: "Utilisez votre lien personnalise, faites des demos, integrez Koraline dans vos offres.",
              },
              {
                step: '3',
                title: 'Recevez vos paiements',
                desc: 'Commissions versees automatiquement chaque mois. Dashboard de suivi en temps reel.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 bg-[#0066CC] text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-5">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* WHY PARTNER                                                      */}
      {/* ================================================================ */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Pourquoi devenir partenaire?
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                title: 'Revenus recurrents',
                desc: 'Commissions mensuelles aussi longtemps que vos clients restent abonnes.',
              },
              {
                title: 'Produit qui se vend',
                desc: 'Suite tout-en-un a prix competitif. Faite au Quebec, en francais. Facile a recommander.',
              },
              {
                title: 'Support dedie',
                desc: 'Gestionnaire de compte, formation produit, materiel marketing, co-branding.',
              },
              {
                title: 'Aucun investissement',
                desc: "Pas de frais d'adhesion. Pas de minimum. Commencez gratuitement, gagnez des le premier client.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl border border-gray-100 p-8 hover:border-[#0066CC]/20 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CTA FINAL                                                        */}
      {/* ================================================================ */}
      <section className="py-24 bg-[#003366]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pret a devenir partenaire?
          </h2>
          <p className="text-lg text-blue-200 mb-10 max-w-xl mx-auto">
            Contactez notre equipe pour discuter du programme qui correspond le mieux
            a votre activite.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-[#003366] font-semibold rounded-full hover:bg-blue-50 transition-colors text-base"
            >
              Nous contacter
              <ArrowRightIcon />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#0066CC] text-white font-semibold rounded-full hover:bg-[#0052A3] transition-colors text-base border border-white/10"
            >
              Demander une demo
            </Link>
          </div>
          <p className="text-xs text-blue-300 mt-6">
            Programme ouvert aux professionnels et entreprises au Canada.
          </p>
        </div>
      </section>
    </>
  );
}
