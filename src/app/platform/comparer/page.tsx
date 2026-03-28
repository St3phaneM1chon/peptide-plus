import { Metadata } from 'next';
import Link from 'next/link';

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                  */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Pourquoi choisir Koraline? Comparaison avec vos outils actuels | Attitudes VIP',
  description:
    'Comparez Koraline avec Shopify, Mailchimp, QuickBooks et HubSpot. Une seule plateforme, un seul prix.',
  openGraph: {
    title: 'Pourquoi choisir Koraline?',
    description:
      'Comparez Koraline avec Shopify, Mailchimp, QuickBooks et HubSpot. Une seule plateforme, un seul prix.',
    url: 'https://attitudes.vip/platform/comparer',
    type: 'website',
  },
};

/* -------------------------------------------------------------------------- */
/*  Data                                                                      */
/* -------------------------------------------------------------------------- */

interface ComparisonRow {
  category: string;
  koraline: string | true;
  shopify: string | true | false;
  mailchimp: string | true | false;
  quickbooks: string | true | false;
  hubspot: string | true | false;
}

const comparisonData: ComparisonRow[] = [
  {
    category: 'Boutique en ligne',
    koraline: true,
    shopify: true,
    mailchimp: false,
    quickbooks: false,
    hubspot: false,
  },
  {
    category: 'Catalogue & inventaire',
    koraline: true,
    shopify: true,
    mailchimp: false,
    quickbooks: false,
    hubspot: false,
  },
  {
    category: 'Paiements Stripe',
    koraline: true,
    shopify: true,
    mailchimp: false,
    quickbooks: true,
    hubspot: false,
  },
  {
    category: 'CRM & pipeline',
    koraline: true,
    shopify: false,
    mailchimp: false,
    quickbooks: false,
    hubspot: true,
  },
  {
    category: 'Comptabilite complete',
    koraline: true,
    shopify: false,
    mailchimp: false,
    quickbooks: true,
    hubspot: false,
  },
  {
    category: 'TVQ/TPS automatique',
    koraline: true,
    shopify: 'Partiel',
    mailchimp: false,
    quickbooks: true,
    hubspot: false,
  },
  {
    category: 'Email marketing',
    koraline: true,
    shopify: 'Basique',
    mailchimp: true,
    quickbooks: false,
    hubspot: true,
  },
  {
    category: 'Telephonie VoIP',
    koraline: true,
    shopify: false,
    mailchimp: false,
    quickbooks: false,
    hubspot: false,
  },
  {
    category: 'Chat en direct',
    koraline: true,
    shopify: false,
    mailchimp: false,
    quickbooks: false,
    hubspot: true,
  },
  {
    category: 'Tickets support',
    koraline: true,
    shopify: false,
    mailchimp: false,
    quickbooks: false,
    hubspot: true,
  },
  {
    category: 'LMS / Formation',
    koraline: true,
    shopify: false,
    mailchimp: false,
    quickbooks: false,
    hubspot: false,
  },
  {
    category: 'Blog integre',
    koraline: true,
    shopify: true,
    mailchimp: false,
    quickbooks: false,
    hubspot: true,
  },
  {
    category: 'Programme fidelite',
    koraline: true,
    shopify: false,
    mailchimp: false,
    quickbooks: false,
    hubspot: false,
  },
  {
    category: 'Ambassadeurs / Affiliation',
    koraline: true,
    shopify: false,
    mailchimp: false,
    quickbooks: false,
    hubspot: false,
  },
  {
    category: 'IA integree',
    koraline: true,
    shopify: 'Basique',
    mailchimp: 'Basique',
    quickbooks: false,
    hubspot: true,
  },
  {
    category: '22 langues',
    koraline: true,
    shopify: true,
    mailchimp: 'Partiel',
    quickbooks: false,
    hubspot: true,
  },
  {
    category: 'Domaine personnalise',
    koraline: true,
    shopify: true,
    mailchimp: false,
    quickbooks: false,
    hubspot: true,
  },
  {
    category: 'Commission sur ventes',
    koraline: '0%',
    shopify: '0.5-2%',
    mailchimp: 'N/A',
    quickbooks: 'N/A',
    hubspot: 'N/A',
  },
];

const pricingComparison = [
  { name: 'Shopify', category: 'Commerce', price: '99-399' },
  { name: 'Mailchimp', category: 'Marketing', price: '45-350' },
  { name: 'QuickBooks', category: 'Comptabilite', price: '35-120' },
  { name: 'HubSpot', category: 'CRM', price: '50-500' },
];

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
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

function CellValue({ value }: { value: string | true | false }) {
  if (value === true) return <CheckIcon />;
  if (value === false) return <CrossIcon />;
  return <span className="text-xs font-medium text-gray-500">{value}</span>;
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function ComparePage() {
  return (
    <>
      {/* ================================================================ */}
      {/* HERO                                                             */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-br from-[#0066CC]/8 to-[#003366]/4 rounded-full blur-3xl -z-10" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-[#0066CC] text-xs font-semibold rounded-full mb-8 uppercase tracking-wider">
            Comparaison
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
            Pourquoi choisir{' '}
            <span className="text-[#0066CC]">Koraline</span>?
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Une seule plateforme qui remplace Shopify, Mailchimp, QuickBooks et
            HubSpot — pour une fraction du cout.
          </p>
        </div>
      </section>

      {/* ================================================================ */}
      {/* COMPARISON TABLE                                                 */}
      {/* ================================================================ */}
      <section className="pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left text-sm font-semibold text-gray-500 px-6 py-4 w-[200px]">
                      Fonctionnalite
                    </th>
                    <th className="text-center text-sm font-bold text-[#0066CC] px-4 py-4 bg-blue-50/50">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-base">Koraline</span>
                        <span className="text-xs font-normal text-gray-400">Tout-en-un</span>
                      </div>
                    </th>
                    <th className="text-center text-sm font-medium text-gray-500 px-4 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span>Shopify</span>
                        <span className="text-xs font-normal text-gray-400">Commerce</span>
                      </div>
                    </th>
                    <th className="text-center text-sm font-medium text-gray-500 px-4 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span>Mailchimp</span>
                        <span className="text-xs font-normal text-gray-400">Marketing</span>
                      </div>
                    </th>
                    <th className="text-center text-sm font-medium text-gray-500 px-4 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span>QuickBooks</span>
                        <span className="text-xs font-normal text-gray-400">Compta</span>
                      </div>
                    </th>
                    <th className="text-center text-sm font-medium text-gray-500 px-4 py-4">
                      <div className="flex flex-col items-center gap-1">
                        <span>HubSpot</span>
                        <span className="text-xs font-normal text-gray-400">CRM</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comparisonData.map((row) => (
                    <tr key={row.category} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.category}</td>
                      <td className="px-4 py-4 bg-blue-50/30">
                        <div className="flex justify-center">
                          <CellValue value={row.koraline} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <CellValue value={row.shopify} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <CellValue value={row.mailchimp} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <CellValue value={row.quickbooks} />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <CellValue value={row.hubspot} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PRICE COMPARISON                                                 */}
      {/* ================================================================ */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Le vrai cout de vos outils
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              4 abonnements separes coutent entre 229$ et 1 369$ par mois.
              Koraline Pro: 299$/mois, tout inclus.
            </p>
          </div>

          {/* Stacked competitor costs */}
          <div className="max-w-3xl mx-auto mb-12">
            <div className="space-y-3 mb-8">
              {pricingComparison.map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-5"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900">{tool.name}</p>
                    <p className="text-xs text-gray-500">{tool.category}</p>
                  </div>
                  <p className="text-sm font-semibold text-red-600">{tool.price}$/mois</p>
                </div>
              ))}
              {/* Total */}
              <div className="flex items-center justify-between bg-red-50 rounded-xl border border-red-100 p-5">
                <p className="text-sm font-bold text-red-700">Total 4 outils</p>
                <p className="text-lg font-extrabold text-red-700">~800$/mois</p>
              </div>
            </div>

            {/* VS */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-lg font-bold text-gray-400">VS</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Koraline */}
            <div className="bg-gradient-to-br from-[#0066CC] to-[#003366] rounded-2xl p-8 text-center text-white shadow-xl shadow-blue-200">
              <p className="text-sm text-blue-200 font-medium mb-1">Suite Koraline Pro</p>
              <p className="text-5xl font-extrabold mb-2">299$/mois</p>
              <p className="text-blue-200 text-sm mb-6">
                Commerce + CRM + Comptabilite + Marketing + VoIP + LMS + IA
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 px-8 py-3 bg-white text-[#003366] font-semibold rounded-full hover:bg-blue-50 transition-colors text-sm"
                >
                  Reserver une demo
                  <ArrowRightIcon />
                </Link>
                <Link
                  href="/platform/calculateur-roi"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-semibold rounded-full hover:bg-white/20 transition-colors text-sm border border-white/20"
                >
                  Calculer mon ROI
                </Link>
              </div>
            </div>
          </div>

          {/* Savings math */}
          <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <p className="text-3xl font-extrabold text-green-600 mb-1">501$/mo</p>
              <p className="text-sm text-gray-500">Economies mensuelles</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <p className="text-3xl font-extrabold text-green-600 mb-1">6 012$/an</p>
              <p className="text-sm text-gray-500">Economies annuelles</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <p className="text-3xl font-extrabold text-[#0066CC] mb-1">63%</p>
              <p className="text-sm text-gray-500">Reduction des couts</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* ADVANTAGES                                                       */}
      {/* ================================================================ */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Les avantages d&apos;une plateforme unifiee
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Zero integration',
                desc: 'Pas de Zapier, pas de webhooks fragiles. Tout communique nativement.',
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.756a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364L4.34 8.374" />
                  </svg>
                ),
              },
              {
                title: 'Une seule facture',
                desc: 'Un seul abonnement au lieu de 4-8 factures separees chaque mois.',
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                ),
              },
              {
                title: 'Donnees unifiees',
                desc: 'Vos clients, ventes, comptabilite — tout vit dans la meme base de donnees.',
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                ),
              },
              {
                title: 'Support unique',
                desc: "Un seul numero a appeler. Un seul support qui connait toute votre configuration.",
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                ),
              },
              {
                title: 'Formation incluse',
                desc: 'LMS integre avec tutoriels, quiz et progression — pour vous et votre equipe.',
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                  </svg>
                ),
              },
              {
                title: 'IA partout',
                desc: "Aurelia, l'IA integree, aide dans chaque module: redaction, analyse, automatisation.",
                icon: (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group bg-white rounded-2xl border border-gray-100 p-8 hover:border-[#0066CC]/20 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-blue-50 text-[#0066CC] rounded-xl flex items-center justify-center mb-5 group-hover:bg-[#0066CC] group-hover:text-white transition-colors duration-300">
                  {item.icon}
                </div>
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
            Arretez de payer pour 4 outils
          </h2>
          <p className="text-lg text-blue-200 mb-10 max-w-xl mx-auto">
            Centralisez tout dans Koraline et economisez des centaines de dollars
            chaque mois.
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
            Aucune commission sur vos ventes. Aucun frais cache.
          </p>
        </div>
      </section>
    </>
  );
}
