'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

/* -------------------------------------------------------------------------- */
/*  Koraline pricing reference (mirrors stripe-attitudes.ts)                  */
/* -------------------------------------------------------------------------- */

const KORALINE_PLANS = {
  essential: { name: 'Essentiel', price: 149, seats: 1 },
  pro: { name: 'Pro', price: 299, seats: 3 },
  enterprise: { name: 'Enterprise', price: 599, seats: 6 },
} as const;

const EXTRA_SEAT_PRICE = 25; // average $/month per extra seat

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function ArrowRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Slider component                                                          */
/* -------------------------------------------------------------------------- */

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-lg font-bold text-gray-900 tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #0066CC ${pct}%, #e5e7eb ${pct}%)`,
        }}
        aria-label={label}
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{min}{suffix}</span>
        <span>{max}{suffix}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stat Card                                                                 */
/* -------------------------------------------------------------------------- */

function StatCard({
  icon,
  label,
  value,
  detail,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 transition-all duration-500 ${
        highlight
          ? 'bg-gradient-to-br from-[#0066CC] to-[#003366] border-transparent text-white shadow-xl shadow-blue-200'
          : 'bg-white border-gray-100'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
          highlight ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#0066CC]'
        }`}
      >
        {icon}
      </div>
      <p className={`text-sm font-medium mb-1 ${highlight ? 'text-blue-200' : 'text-gray-500'}`}>
        {label}
      </p>
      <p
        className={`text-3xl sm:text-4xl font-extrabold mb-2 tabular-nums ${
          highlight ? 'text-white' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
      <p className={`text-sm ${highlight ? 'text-blue-200' : 'text-gray-500'}`}>{detail}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function ROICalculatorPage() {
  const [numTools, setNumTools] = useState(4);
  const [currentCost, setCurrentCost] = useState(600);
  const [numEmployees, setNumEmployees] = useState(5);
  const [adminHours, setAdminHours] = useState(15);

  const results = useMemo(() => {
    // Determine the best Koraline plan
    let plan: { readonly name: string; readonly price: number; readonly seats: number } = KORALINE_PLANS.essential;
    if (numEmployees > 3) plan = KORALINE_PLANS.pro;
    if (numEmployees > 10) plan = KORALINE_PLANS.enterprise;

    const extraSeats = Math.max(0, numEmployees - plan.seats);
    const koralineCost = plan.price + extraSeats * EXTRA_SEAT_PRICE;
    const monthlySavings = Math.max(0, currentCost - koralineCost);
    const annualSavings = monthlySavings * 12;
    const hoursSaved = Math.round(adminHours * 0.4);
    const annualHoursSaved = hoursSaved * 52;

    return {
      planName: plan.name,
      koralineCost,
      monthlySavings,
      annualSavings,
      hoursSaved,
      annualHoursSaved,
    };
  }, [numTools, currentCost, numEmployees, adminHours]);

  return (
    <>
      {/* ================================================================ */}
      {/* HERO                                                             */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-to-br from-[#0066CC]/8 to-[#003366]/4 rounded-full blur-3xl -z-10" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-[#0066CC] text-xs font-semibold rounded-full mb-8 uppercase tracking-wider">
            Calculateur ROI
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
            Combien pourriez-vous{' '}
            <span className="text-[#0066CC]">economiser</span>?
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Entrez vos chiffres actuels et decouvrez combien vous pourriez economiser
            en centralisant vos outils avec Koraline.
          </p>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CALCULATOR                                                       */}
      {/* ================================================================ */}
      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* ---- Inputs ---- */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Votre situation actuelle</h2>
                <p className="text-sm text-gray-500">
                  Ajustez les curseurs pour refleter votre utilisation actuelle.
                </p>
              </div>

              <Slider
                label="Nombre d'outils actuels"
                value={numTools}
                onChange={setNumTools}
                min={1}
                max={10}
                suffix=" outils"
              />

              {/* Cost input with manual entry */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="cost-input" className="text-sm font-medium text-gray-700">
                    Cout mensuel total actuel
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="cost-input"
                      type="number"
                      value={currentCost}
                      onChange={(e) => setCurrentCost(Math.max(0, Number(e.target.value)))}
                      className="w-24 text-right text-lg font-bold text-gray-900 border border-gray-200 rounded-lg px-3 py-1 focus:ring-2 focus:ring-[#0066CC] focus:border-transparent outline-none tabular-nums"
                      min={0}
                      max={5000}
                      aria-label="Cout mensuel actuel en dollars"
                    />
                    <span className="text-lg font-bold text-gray-900">$</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3000}
                  step={50}
                  value={currentCost}
                  onChange={(e) => setCurrentCost(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #0066CC ${(currentCost / 3000) * 100}%, #e5e7eb ${(currentCost / 3000) * 100}%)`,
                  }}
                  aria-label="Cout mensuel curseur"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0$</span>
                  <span>3 000$</span>
                </div>
              </div>

              <Slider
                label="Nombre d'employes"
                value={numEmployees}
                onChange={setNumEmployees}
                min={1}
                max={50}
              />

              <Slider
                label="Heures/semaine sur l'admin"
                value={adminHours}
                onChange={setAdminHours}
                min={1}
                max={40}
                suffix="h"
              />

              {/* Current tools illustration */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                  Vous payez pour {numTools} outils:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Shopify',
                    'Mailchimp',
                    'QuickBooks',
                    'HubSpot',
                    'Zendesk',
                    'Zoom Phone',
                    'Teachable',
                    'Zapier',
                    'Monday',
                    'Slack',
                  ]
                    .slice(0, numTools)
                    .map((tool) => (
                      <span
                        key={tool}
                        className="inline-flex items-center px-2.5 py-1 bg-white text-xs font-medium text-gray-600 rounded-md border border-gray-200"
                      >
                        {tool}
                      </span>
                    ))}
                </div>
              </div>
            </div>

            {/* ---- Results ---- */}
            <div className="space-y-6">
              <div className="grid gap-6">
                <StatCard
                  icon={<DollarIcon />}
                  label="Economies annuelles"
                  value={`${results.annualSavings.toLocaleString('fr-CA')}$`}
                  detail={`${results.monthlySavings.toLocaleString('fr-CA')}$ d'economies par mois`}
                  highlight
                />
                <div className="grid grid-cols-2 gap-6">
                  <StatCard
                    icon={<ClockIcon />}
                    label="Heures gagnees / an"
                    value={`${results.annualHoursSaved}`}
                    detail={`${results.hoursSaved}h de moins par semaine`}
                  />
                  <StatCard
                    icon={<ChartIcon />}
                    label="Cout Koraline"
                    value={`${results.koralineCost}$/mo`}
                    detail={`Plan ${results.planName}`}
                  />
                </div>
              </div>

              {/* Comparison bar */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Comparaison mensuelle
                </h3>
                <div className="space-y-4">
                  {/* Current */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-600">{numTools} outils actuels</span>
                      <span className="font-bold text-gray-900">{currentCost}$/mois</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, (currentCost / Math.max(currentCost, results.koralineCost)) * 100)}%` }}
                      />
                    </div>
                  </div>
                  {/* Koraline */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-600">Koraline {results.planName}</span>
                      <span className="font-bold text-[#0066CC]">{results.koralineCost}$/mois</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0066CC] rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, (results.koralineCost / Math.max(currentCost, results.koralineCost)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#0066CC] text-white font-semibold rounded-full hover:bg-[#0052A3] transition-all shadow-lg shadow-blue-200 text-base flex-1"
                >
                  Commencez a economiser
                  <ArrowRightIcon />
                </Link>
                <Link
                  href="/platform/comparer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-gray-700 font-semibold rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-base"
                >
                  Comparer
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* TRUST                                                            */}
      {/* ================================================================ */}
      <section className="py-16 bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-extrabold text-gray-900 mb-1">40%</p>
              <p className="text-sm text-gray-500">de reduction du temps admin en moyenne</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-900 mb-1">1 plateforme</p>
              <p className="text-sm text-gray-500">remplace 4-8 outils separes</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-900 mb-1">0%</p>
              <p className="text-sm text-gray-500">de commission sur vos ventes</p>
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
            Pret a simplifier et economiser?
          </h2>
          <p className="text-lg text-blue-200 mb-10 max-w-xl mx-auto">
            Rejoignez les entreprises quebecoises qui ont dit adieu aux outils
            fragmentes.
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
