'use client';

/**
 * Change Plan — Upgrade/downgrade Koraline plan
 * URL: /admin/abonnement/plan
 */

import { useState, useEffect } from 'react';
import { KORALINE_PLANS, type KoralinePlan } from '@/lib/stripe-constants';

export default function ChangePlanPage() {
  const [currentPlan, setCurrentPlan] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [message, setMessage] = useState('');

  const plans = Object.entries(KORALINE_PLANS) as [KoralinePlan, typeof KORALINE_PLANS[KoralinePlan]][];

  useEffect(() => {
    fetch('/api/platform/subscription')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.tenant?.plan) {
          setCurrentPlan(data.tenant.plan);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChangePlan = async (newPlan: KoralinePlan) => {
    if (newPlan === currentPlan) return;

    const isUpgrade = KORALINE_PLANS[newPlan].monthlyPrice > KORALINE_PLANS[currentPlan as KoralinePlan]?.monthlyPrice;

    if (!confirm(
      isUpgrade
        ? `Passer au plan ${KORALINE_PLANS[newPlan].name} ? La proration sera appliquée immédiatement.`
        : `Rétrograder au plan ${KORALINE_PLANS[newPlan].name} ? Le changement sera effectif en fin de période.`
    )) return;

    setChanging(true);
    setMessage('');

    try {
      const res = await fetch('/api/platform/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentPlan(newPlan);
        setMessage(data.message || 'Plan mis à jour avec succès');
      } else {
        setMessage(data.error || 'Erreur lors du changement de plan');
      }
    } catch {
      setMessage('Erreur de connexion');
    } finally {
      setChanging(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <a href="/admin/abonnement" className="text-sm text-gray-500 hover:text-gray-700">
          &#8592; Retour à l&apos;abonnement
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Changer de plan</h1>
        <p className="text-gray-500 mt-1">
          Upgrade immédiat avec proration. Downgrade effectif en fin de période.
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg mb-6 text-sm ${
          message.includes('succès') || message.includes('mis à jour')
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map(([key, plan]) => {
          const isCurrent = currentPlan === key;
          const isPro = key === 'pro';
          return (
            <div
              key={key}
              className={`relative rounded-2xl border-2 p-6 transition-all ${
                isCurrent
                  ? 'border-blue-600 bg-blue-50/50 shadow-lg'
                  : 'border-gray-200 bg-[var(--k-glass-thin)] hover:border-gray-300'
              }`}
            >
              {isPro && !isCurrent && (
                <span className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                  Populaire
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-6 px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-full">
                  Plan actuel
                </span>
              )}

              <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900">
                  {(plan.monthlyPrice / 100).toFixed(0)}$
                </span>
                <span className="text-gray-500">/mois</span>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-500 mt-0.5">&#10003;</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2.5 bg-gray-100 text-gray-400 font-medium rounded-lg cursor-not-allowed"
                >
                  Plan actuel
                </button>
              ) : (
                <button
                  onClick={() => handleChangePlan(key)}
                  disabled={changing}
                  className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {changing ? '...' : (
                    plan.monthlyPrice > (KORALINE_PLANS[currentPlan as KoralinePlan]?.monthlyPrice || 0)
                      ? 'Passer à ce plan'
                      : 'Rétrograder'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
