import { Metadata } from 'next';
import Link from 'next/link';
import { getAllModules } from '@/lib/marketing/module-data';

export const metadata: Metadata = {
  title: 'Fonctionnalites — Suite Koraline | Attitudes VIP',
  description:
    '11 modules integres qui fonctionnent ensemble. Commerce, CRM, comptabilite, marketing, telephonie, formation, emails, medias, fidelite, communaute et IA. Pas de patchwork.',
  openGraph: {
    title: 'Fonctionnalites — Suite Koraline',
    description:
      '11 modules integres qui fonctionnent ensemble. Pas de patchwork.',
    url: 'https://attitudes.vip/platform/features',
  },
};

export default function FeaturesOverviewPage() {
  const modules = getAllModules();

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white pt-20 pb-16 text-center">
        {/* Subtle decorative elements */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#0066CC]/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0066CC]/10 text-[#0066CC] rounded-full text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 bg-[#0066CC] rounded-full" />
            11 modules integres
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-5 leading-[1.1]">
            Tout ce dont votre{' '}
            <span className="text-[#0066CC]">entreprise</span> a besoin
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            11 modules integres qui fonctionnent ensemble.{' '}
            <span className="font-medium text-gray-800">
              Pas de patchwork.
            </span>{' '}
            Un seul outil, un seul prix, des donnees qui circulent.
          </p>
        </div>
      </section>

      {/* Module grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod) => (
            <Link
              key={mod.slug}
              href={`/platform/features/${mod.slug}`}
              className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 hover:border-[#0066CC]/30 hover:shadow-lg hover:shadow-[#0066CC]/5 transition-all duration-200"
            >
              {/* Icon + feature count */}
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl" aria-hidden="true">
                  {mod.icon}
                </span>
                <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                  {mod.features.length} fonctions
                </span>
              </div>

              {/* Name */}
              <h2 className="text-lg font-semibold text-gray-900 mb-1.5 group-hover:text-[#0066CC] transition-colors">
                {mod.name}
              </h2>

              {/* Tagline */}
              <p className="text-sm text-gray-500 leading-relaxed flex-1">
                {mod.tagline}
              </p>

              {/* Plan info */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                {mod.includedIn.length > 0 ? (
                  <span className="text-xs text-emerald-600 font-medium">
                    Inclus dans {mod.includedIn[0]}
                  </span>
                ) : mod.addonPrice ? (
                  <span className="text-xs text-gray-500">
                    A partir de {(mod.addonPrice / 100).toFixed(0)} $/mois
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">
                    Sur demande
                  </span>
                )}

                <span className="text-xs text-[#0066CC] font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  Explorer
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            Pret a simplifier votre gestion ?
          </h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Choisissez le plan qui vous convient. Ajoutez des modules au fil de
            votre croissance.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#0066CC] text-white font-semibold rounded-xl hover:bg-[#005bb5] transition-colors"
            >
              Voir les tarifs
            </Link>
            <Link
              href="/platform/integrations"
              className="inline-flex items-center justify-center px-6 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Comment ca marche ensemble
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
