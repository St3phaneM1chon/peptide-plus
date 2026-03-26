'use client';

/**
 * Module Marketplace — Self-service module management
 * URL: /admin/abonnement/modules
 *
 * Displays all available modules with status, pricing, and toggle.
 */

import { useState, useEffect, useCallback } from 'react';

interface ModuleInfo {
  key: string;
  name: string;
  description: string;
  monthlyPrice: number;
  isActive: boolean;
  isAccumulating: boolean;
  accumulation: {
    isFree: boolean;
    freeUntil: string | null;
    monthlyRate: number;
  } | null;
  canActivate: boolean;
  missingDeps: string[];
  requiredPlan: string | null;
}

const MODULE_ICONS: Record<string, string> = {
  crm_advanced: '🎯',
  marketplace_starter: '🏪',
  marketplace_pro: '🏬',
  marketplace_enterprise: '🏢',
  chat: '💬',
  email_marketing: '📧',
  loyalty: '⭐',
  subscriptions: '🔄',
  ambassadors: '🤝',
  monitoring: '📊',
  accounting_advanced: '📋',
};

export default function ModuleMarketplacePage() {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ module: ModuleInfo; action: 'activate' | 'deactivate' } | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch('/api/platform/modules');
      if (res.ok) {
        const data = await res.json();
        setModules(data.modules || []);
        setPlan(data.plan || '');
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleActivate = async (moduleKey: string) => {
    setActionLoading(moduleKey);
    setConfirmModal(null);
    try {
      const res = await fetch('/api/platform/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleKey }),
      });
      if (res.ok) {
        await fetchModules();
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de l\'activation');
      }
    } catch {
      alert('Erreur de connexion');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (moduleKey: string, keepAccumulation: boolean) => {
    setActionLoading(moduleKey);
    setConfirmModal(null);
    try {
      const res = await fetch('/api/platform/modules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleKey, keepAccumulation }),
      });
      if (res.ok) {
        await fetchModules();
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur lors de la désactivation');
      }
    } catch {
      alert('Erreur de connexion');
    } finally {
      setActionLoading(null);
    }
  };

  const totalMonthly = modules
    .filter(m => m.isActive)
    .reduce((sum, m) => sum + m.monthlyPrice, 0);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modules</h1>
          <p className="text-gray-500 mt-1">
            Activez ou désactivez des modules pour personnaliser votre suite Koraline.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Total modules actifs</p>
          <p className="text-2xl font-bold text-gray-900">
            {(totalMonthly / 100).toFixed(2)} $ <span className="text-sm font-normal text-gray-500">/ mois</span>
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {modules.map((mod) => (
          <div
            key={mod.key}
            className={`rounded-xl border-2 p-5 transition-all ${
              mod.isActive
                ? 'border-blue-200 bg-blue-50/30'
                : mod.isAccumulating
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-gray-200 bg-[var(--k-glass-thin)]'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{MODULE_ICONS[mod.key] || '📦'}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{mod.name}</h3>
                  <p className="text-sm text-gray-500">{mod.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{(mod.monthlyPrice / 100).toFixed(0)} $</p>
                <p className="text-xs text-gray-500">/ mois</p>
              </div>
            </div>

            {/* Status badges */}
            <div className="flex items-center gap-2 mb-3">
              {mod.isActive && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  Actif
                </span>
              )}
              {mod.isAccumulating && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                  Accumulation {mod.accumulation?.isFree ? '(gratuit)' : ''}
                </span>
              )}
              {!mod.canActivate && !mod.isActive && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                  Requis: {mod.missingDeps.join(', ')}
                  {mod.requiredPlan ? ` (Plan ${mod.requiredPlan}+)` : ''}
                </span>
              )}
            </div>

            {/* Accumulation info */}
            {mod.isAccumulating && mod.accumulation && (
              <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                {mod.accumulation.isFree
                  ? `Gratuit jusqu'au ${new Date(mod.accumulation.freeUntil!).toLocaleDateString('fr-CA')}`
                  : `${(mod.accumulation.monthlyRate / 100).toFixed(2)} $/mois pour l'accumulation`
                }
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {mod.isActive ? (
                <button
                  onClick={() => setConfirmModal({ module: mod, action: 'deactivate' })}
                  disabled={actionLoading === mod.key}
                  className="flex-1 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  {actionLoading === mod.key ? '...' : 'Désactiver'}
                </button>
              ) : mod.isAccumulating ? (
                <button
                  onClick={() => handleActivate(mod.key)}
                  disabled={actionLoading === mod.key || !mod.canActivate}
                  className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading === mod.key ? '...' : 'Activer maintenant'}
                </button>
              ) : (
                <button
                  onClick={() => setConfirmModal({ module: mod, action: 'activate' })}
                  disabled={actionLoading === mod.key || !mod.canActivate}
                  className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading === mod.key ? '...' : `Activer — ${(mod.monthlyPrice / 100).toFixed(0)} $/mois`}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--k-glass-thin)] rounded-2xl p-6 max-w-md w-full">
            {confirmModal.action === 'activate' ? (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Activer {confirmModal.module.name} ?
                </h3>
                <p className="text-gray-500 mb-4">
                  Ce module sera ajouté à votre abonnement pour{' '}
                  <strong>{(confirmModal.module.monthlyPrice / 100).toFixed(2)} $ CAD/mois</strong>.
                  Le montant sera proratisé sur votre prochaine facture.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleActivate(confirmModal.module.key)}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Confirmer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Désactiver {confirmModal.module.name} ?
                </h3>
                <p className="text-gray-500 mb-4">
                  Voulez-vous conserver l&apos;accumulation de données ? Vos données continueront
                  à se collecter en arrière-plan pour être disponibles quand vous réactiverez le module.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleDeactivate(confirmModal.module.key, true)}
                    className="py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50"
                  >
                    Désactiver avec accumulation
                    {plan !== 'alacarte' && (
                      <span className="block text-xs text-amber-500">Gratuit les 12 premiers mois</span>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeactivate(confirmModal.module.key, false)}
                    className="py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    Désactiver complètement
                  </button>
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="py-2 text-gray-500 hover:text-gray-700"
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
