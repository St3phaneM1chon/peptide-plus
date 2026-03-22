import { Fragment } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { KORALINE_PLANS, KORALINE_MODULES, KORALINE_LICENSES } from '@/lib/stripe-attitudes';

export const metadata: Metadata = {
  title: 'Tarifs — Suite Koraline | Attitudes VIP',
  description:
    'Plans Koraline a partir de 149$/mois. Commerce, CRM, comptabilite, marketing — tout inclus. Modules optionnels et licences employes flexibles.',
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-4 h-4 text-[#0066CC] mt-0.5 shrink-0'} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

/* Detailed feature comparison matrix */
const COMPARISON_CATEGORIES = [
  {
    category: 'Commerce',
    features: [
      { name: 'Catalogue produits illimite', essential: true, pro: true, enterprise: true },
      { name: 'Variantes & options', essential: true, pro: true, enterprise: true },
      { name: 'Gestion inventaire', essential: true, pro: true, enterprise: true },
      { name: 'Commandes & paiements', essential: true, pro: true, enterprise: true },
      { name: 'Livraison & suivi', essential: true, pro: true, enterprise: true },
      { name: 'Bundles produits', essential: false, pro: true, enterprise: true },
      { name: 'Abonnements recurrents', essential: false, pro: true, enterprise: true },
      { name: 'Cartes cadeaux', essential: true, pro: true, enterprise: true },
    ],
  },
  {
    category: 'Marketing',
    features: [
      { name: 'Codes promo', essential: true, pro: true, enterprise: true },
      { name: 'Newsletter basique', essential: true, pro: true, enterprise: true },
      { name: 'SEO integre', essential: true, pro: true, enterprise: true },
      { name: 'Blog & articles', essential: false, pro: true, enterprise: true },
      { name: 'Campagnes email avancees', essential: false, pro: true, enterprise: true },
      { name: 'Ambassadeurs & affiliation', essential: false, pro: true, enterprise: true },
    ],
  },
  {
    category: 'CRM & Clients',
    features: [
      { name: 'Base clients', essential: true, pro: true, enterprise: true },
      { name: 'Pipeline de ventes', essential: false, pro: true, enterprise: true },
      { name: 'Leads & deals', essential: false, pro: true, enterprise: true },
      { name: 'Segmentation avancee', essential: false, pro: false, enterprise: true },
      { name: 'Automatisations CRM', essential: false, pro: false, enterprise: true },
    ],
  },
  {
    category: 'Comptabilite',
    features: [
      { name: 'Journal d\'ecritures', essential: true, pro: true, enterprise: true },
      { name: 'Plan comptable', essential: true, pro: true, enterprise: true },
      { name: 'Rapports financiers', essential: false, pro: true, enterprise: true },
      { name: 'TVQ/TPS automatique', essential: false, pro: true, enterprise: true },
      { name: 'Exportation comptable', essential: false, pro: true, enterprise: true },
      { name: 'Conciliation bancaire', essential: false, pro: false, enterprise: true },
    ],
  },
  {
    category: 'Communications',
    features: [
      { name: 'Emails transactionnels', essential: true, pro: true, enterprise: true },
      { name: 'Notifications push', essential: true, pro: true, enterprise: true },
      { name: 'Chat en direct', essential: false, pro: false, enterprise: true },
      { name: 'Telephonie VoIP', essential: false, pro: false, enterprise: true },
      { name: 'Tickets support', essential: false, pro: false, enterprise: true },
    ],
  },
  {
    category: 'Plateforme',
    features: [
      { name: 'Domaine personnalise', essential: true, pro: true, enterprise: true },
      { name: 'Branding personnalise', essential: true, pro: true, enterprise: true },
      { name: '22 langues', essential: true, pro: true, enterprise: true },
      { name: 'Permissions employes', essential: true, pro: true, enterprise: true },
      { name: 'Support bilingue FR/EN', essential: true, pro: true, enterprise: true },
      { name: 'Support prioritaire', essential: false, pro: false, enterprise: true },
      { name: 'White-label', essential: false, pro: false, enterprise: true },
      { name: 'API & Webhooks', essential: false, pro: false, enterprise: true },
    ],
  },
];

export default function PricingPage() {
  const plans = Object.entries(KORALINE_PLANS) as [string, (typeof KORALINE_PLANS)[keyof typeof KORALINE_PLANS]][];
  const modules = Object.entries(KORALINE_MODULES) as [string, (typeof KORALINE_MODULES)[keyof typeof KORALINE_MODULES]][];
  const licenses = Object.entries(KORALINE_LICENSES) as [string, (typeof KORALINE_LICENSES)[keyof typeof KORALINE_LICENSES]][];

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white pt-20 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            Tarifs simples, sans surprise
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Un abonnement mensuel tout inclus. Pas de commission sur vos ventes. Pas de frais caches.
            Modules optionnels et licences flexibles.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
                    href={index === 2 ? '/demo' : `/signup?plan=${key}`}
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

          {/* Comparison Table */}
          <div className="mb-20">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
              Comparaison detaillee
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-500 w-1/2">Fonctionnalite</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-500">Essentiel</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-[#0066CC]">Pro</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-500">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_CATEGORIES.map((cat) => (
                    <Fragment key={cat.category}>
                      <tr>
                        <td colSpan={4} className="px-6 py-3 bg-gray-50 text-sm font-bold text-gray-700 uppercase tracking-wider">
                          {cat.category}
                        </td>
                      </tr>
                      {cat.features.map((feat) => (
                        <tr key={feat.name} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-3 text-sm text-gray-700">{feat.name}</td>
                          <td className="px-6 py-3 text-center">
                            {feat.essential ? <CheckIcon className="w-4 h-4 text-[#0066CC] mx-auto" /> : <XIcon />}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {feat.pro ? <CheckIcon className="w-4 h-4 text-[#0066CC] mx-auto" /> : <XIcon />}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {feat.enterprise ? <CheckIcon className="w-4 h-4 text-[#0066CC] mx-auto" /> : <XIcon />}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modules */}
          <div className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Modules optionnels
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Personnalisez votre experience en ajoutant les modules dont vous avez besoin.
                Activez ou desactivez chaque mois, sans engagement.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {modules.map(([, mod]) => (
                <div
                  key={mod.name}
                  className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-100 hover:border-[#0066CC]/20 hover:shadow-sm transition-all"
                >
                  <span className="text-sm font-medium text-gray-900">{mod.name}</span>
                  <span className="text-sm font-bold text-[#0066CC] whitespace-nowrap ml-4">
                    {(mod.monthlyPrice / 100).toFixed(0)}$/mo
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Licenses */}
          <div className="mb-16">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Licences employes
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Chaque plan inclut la licence proprietaire. Les employes supplementaires
                sont factures individuellement selon leur niveau d&apos;acces.
              </p>
            </div>
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-sm font-semibold text-gray-500">
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4 text-right">Prix/mois</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">Proprietaire</span>
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Inclus</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">Acces complet, facturation, parametres</td>
                    <td className="px-6 py-4 text-right text-sm text-gray-500">Inclus</td>
                  </tr>
                  {licenses.map(([key, license]) => {
                    const descriptions: Record<string, string> = {
                      admin: 'Gestion complete sauf facturation',
                      manager: 'Gestion produits, commandes, contenu',
                      employee: 'Operations quotidiennes',
                      readonly: 'Consultation rapports et donnees',
                    };
                    return (
                      <tr key={license.name}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{license.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{descriptions[key] || ''}</td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-gray-700">
                          {(license.monthlyPrice / 100).toFixed(0)}$/mois
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#003366]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Pret a commencer?
          </h2>
          <p className="text-lg text-blue-200 mb-8">
            Reservez une demo pour voir Koraline en action, ou lancez-vous directement.
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
