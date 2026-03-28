import { Metadata } from 'next';
import Link from 'next/link';
import { getAllModules } from '@/lib/marketing/module-data';

export const metadata: Metadata = {
  title: 'Integrations — Suite Koraline | Attitudes VIP',
  description:
    'Decouvrez comment les 11 modules Koraline fonctionnent ensemble. Vos donnees circulent automatiquement entre commerce, CRM, comptabilite, marketing et plus.',
  openGraph: {
    title: 'Integrations — Suite Koraline',
    description:
      'La puissance du tout-en-un. 11 modules connectes nativement.',
    url: 'https://attitudes.vip/platform/integrations',
  },
};

/* -------------------------------------------------------------------------- */
/*  Workflow examples                                                         */
/* -------------------------------------------------------------------------- */

interface WorkflowStep {
  icon: string;
  label: string;
  module: string;
}

interface Workflow {
  title: string;
  description: string;
  steps: WorkflowStep[];
}

const WORKFLOWS: Workflow[] = [
  {
    title: 'De l\'achat a la comptabilite',
    description:
      'Un client passe commande en ligne. Le CRM est mis a jour, la facture est generee, et l\'ecriture comptable est enregistree automatiquement.',
    steps: [
      { icon: '🛒', label: 'Client achete', module: 'commerce' },
      { icon: '🤝', label: 'CRM mis a jour', module: 'crm' },
      { icon: '🧾', label: 'Facture generee', module: 'comptabilite' },
      { icon: '📒', label: 'Ecriture comptable', module: 'comptabilite' },
    ],
  },
  {
    title: 'Appel client intelligent',
    description:
      'Un client appelle. Sa fiche CRM s\'ouvre automatiquement. L\'agent prend des notes qui se synchronisent avec l\'historique du client.',
    steps: [
      { icon: '📞', label: 'Appel VoIP entrant', module: 'telephonie' },
      { icon: '🤝', label: 'Fiche CRM ouverte', module: 'crm' },
      { icon: '📝', label: 'Note ajoutee', module: 'crm' },
      { icon: '✉️', label: 'Courriel de suivi', module: 'emails' },
    ],
  },
  {
    title: 'Formation et fidelite',
    description:
      'Un employe termine un cours. Son certificat est genere, ses points de fidelite sont credites, et son manager est notifie.',
    steps: [
      { icon: '🎓', label: 'Cours complete', module: 'formation' },
      { icon: '🏅', label: 'Certificat genere', module: 'formation' },
      { icon: '🏆', label: 'Points credites', module: 'fidelite' },
      { icon: '✉️', label: 'Notification envoyee', module: 'emails' },
    ],
  },
  {
    title: 'Campagne marketing mesuree',
    description:
      'Vous lancez une campagne email. Les ventes sont tracees, le ROI est calcule en temps reel, et les meilleurs clients sont segmentes automatiquement.',
    steps: [
      { icon: '📣', label: 'Campagne envoyee', module: 'marketing' },
      { icon: '✉️', label: 'Emails delivres', module: 'emails' },
      { icon: '🛒', label: 'Ventes suivies', module: 'commerce' },
      { icon: '📊', label: 'ROI calcule', module: 'comptabilite' },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function IntegrationsPage() {
  const modules = getAllModules();

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white pt-20 pb-16 text-center">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#0066CC]/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0066CC]/10 text-[#0066CC] rounded-full text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 bg-[#0066CC] rounded-full" />
            Tout-en-un natif
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-5 leading-[1.1]">
            La puissance du{' '}
            <span className="text-[#0066CC]">tout-en-un</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Chez Koraline, les modules ne sont pas des plugins greffes apres
            coup. Ils sont concus ensemble et partagent les memes donnees en
            temps reel.
          </p>
        </div>
      </section>

      {/* Integration hub diagram */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            11 modules. Un seul ecosysteme.
          </h2>
          <p className="text-gray-500">
            Cliquez sur un module pour decouvrir ses fonctionnalites.
          </p>
        </div>

        {/* Visual hub — modules as a ring around the Koraline logo */}
        <div className="relative mx-auto w-full max-w-xl aspect-square">
          {/* Center node */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-24 h-24 rounded-2xl bg-[#0066CC] text-white flex flex-col items-center justify-center shadow-lg shadow-[#0066CC]/20">
            <span className="text-2xl font-bold">K</span>
            <span className="text-[10px] font-medium mt-0.5">Koraline</span>
          </div>

          {/* Connection lines — pure CSS radial lines */}
          <div className="absolute inset-0" aria-hidden="true">
            {modules.map((_, i) => {
              const angle = (360 / modules.length) * i - 90;
              return (
                <div
                  key={`line-${i}`}
                  className="absolute left-1/2 top-1/2 origin-left h-px bg-gradient-to-r from-[#0066CC]/20 to-transparent"
                  style={{
                    width: '38%',
                    transform: `rotate(${angle}deg)`,
                  }}
                />
              );
            })}
          </div>

          {/* Module nodes positioned in a circle */}
          {modules.map((mod, i) => {
            const angle = ((360 / modules.length) * i - 90) * (Math.PI / 180);
            const radius = 42; // % from center
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);

            return (
              <Link
                key={mod.slug}
                href={`/platform/features/${mod.slug}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1 group"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-2xl shadow-sm group-hover:border-[#0066CC]/40 group-hover:shadow-md transition-all">
                  {mod.icon}
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-gray-600 group-hover:text-[#0066CC] transition-colors whitespace-nowrap">
                  {mod.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Workflow examples */}
      <section className="bg-gray-50 border-t border-gray-200 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Comment vos donnees circulent
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Voici des exemples concrets de workflows automatiques entre
              modules. Aucune configuration requise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {WORKFLOWS.map((wf, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {wf.title}
                </h3>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                  {wf.description}
                </p>

                {/* Step flow */}
                <div className="flex items-center gap-0">
                  {wf.steps.map((step, j) => (
                    <div key={j} className="flex items-center">
                      <div className="flex flex-col items-center text-center min-w-[72px]">
                        <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-lg mb-1.5">
                          {step.icon}
                        </div>
                        <span className="text-[10px] text-gray-500 leading-tight px-1">
                          {step.label}
                        </span>
                      </div>
                      {j < wf.steps.length - 1 && (
                        <svg
                          className="w-5 h-5 text-[#0066CC]/30 shrink-0 -mt-4"
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
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why all-in-one */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Pourquoi le tout-en-un ?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-xl">
                ⚡
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Zero configuration
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Pas de connecteurs a configurer, pas d&apos;API a brancher. Les
                modules se parlent des le premier jour.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-xl">
                🔄
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Donnees en temps reel
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Une vente dans Commerce met a jour CRM, Comptabilite et Fidelite
                dans la meme seconde. Pas de synchronisation differee.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-xl">
                💰
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Un seul prix
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Au lieu de payer 5 abonnements separes (CRM + comptabilite +
                emails + ...), tout est reuni dans un plan unique.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            Pret a tout centraliser ?
          </h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Decouvrez les tarifs Koraline et commencez a vendre, gerer et
            fideliser depuis un seul endroit.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#0066CC] text-white font-semibold rounded-xl hover:bg-[#005bb5] transition-colors"
            >
              Voir les tarifs
            </Link>
            <Link
              href="/platform/features"
              className="inline-flex items-center justify-center px-6 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Explorer les modules
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
