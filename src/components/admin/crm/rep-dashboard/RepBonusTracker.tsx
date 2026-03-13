'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { addCSRFHeader } from '@/lib/csrf';
import {
  Gift,
  Calculator,
  Loader2,
  Award,
  TrendingUp,
  Zap,
  Coins,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface BonusTier {
  id: string;
  name: string;
  type: string; // SALES, ACTIVITY, HYBRID
  thresholds?: Record<string, number> | null;
  rates?: Record<string, number> | null;
}

interface Payout {
  id: string;
  period: string;
  salesPayout: number;
  activityPayout: number;
  totalPayout: number;
  volumeThreshold?: number | null;
  volumeActual?: number | null;
  prequalScore?: number | null;
  prequalThreshold?: number | null;
  status: string; // PENDING, APPROVED, PAID, REJECTED
}

interface RepBonusTrackerProps {
  agentId: string;
  period: string;
}

// ── Badge config ────────────────────────────────────────────────

const TYPE_BADGES: Record<string, string> = {
  SALES: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ACTIVITY: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  HYBRID: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  APPROVED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

// ── Component ───────────────────────────────────────────────────

export default function RepBonusTracker({ agentId, period }: RepBonusTrackerProps) {
  const { t, locale } = useI18n();
  const [tiers, setTiers] = useState<BonusTier[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [commRes, bonusRes] = await Promise.all([
        fetch(`/api/admin/crm/reps/${agentId}/dashboard?section=commissions&period=${period}`),
        fetch(`/api/admin/crm/reps/${agentId}/bonuses`),
      ]);

      if (!commRes.ok) throw new Error(`Commissions: HTTP ${commRes.status}`);
      if (!bonusRes.ok) throw new Error(`Bonuses: HTTP ${bonusRes.status}`);

      const commData = await commRes.json();
      const bonusData = await bonusRes.json();

      setPayouts(commData.payouts ?? commData.data ?? []);
      setTiers(bonusData.tiers ?? bonusData.data ?? bonusData ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bonus data');
    } finally {
      setLoading(false);
    }
  }, [agentId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await fetch(
        `/api/admin/crm/reps/${agentId}/dashboard?section=commissions&period=${period}`,
        { method: 'POST', headers: addCSRFHeader({}) }
      );
      if (res.ok) {
        fetchData(); // Refresh after calculation
      }
    } catch {
      // Silently fail
    } finally {
      setCalculating(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(locale || 'en', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">{t('common.loading') || 'Loading...'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center text-red-500">{error}</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Active Bonus Tiers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('admin.crm.bonus.activeTiers') || 'Active Bonus Tiers'}
          </h3>
        </div>

        {tiers.length === 0 ? (
          <div className="p-6 text-center">
            <Gift className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('admin.crm.bonus.noTiers') || 'No bonus tiers configured.'}
            </p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {tier.name}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[tier.type] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                    {tier.type}
                  </span>
                </div>

                {tier.thresholds && Object.keys(tier.thresholds).length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span className="font-medium">{t('admin.crm.bonus.thresholds') || 'Thresholds'}:</span>{' '}
                    {Object.entries(tier.thresholds).map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </div>
                )}

                {tier.rates && Object.keys(tier.rates).length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">{t('admin.crm.bonus.rates') || 'Rates'}:</span>{' '}
                    {Object.entries(tier.rates).map(([k, v]) => `${k}: ${(Number(v) * 100).toFixed(1)}%`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Payout History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('admin.crm.bonus.payoutHistory') || 'Payout History'}
            </h3>
          </div>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {calculating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Calculator className="w-3.5 h-3.5" />
            )}
            {t('admin.crm.bonus.calculate') || 'Calculate Period'}
          </button>
        </div>

        {payouts.length === 0 ? (
          <div className="p-6 text-center">
            <Coins className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('admin.crm.bonus.noPayouts') || 'No payouts recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                  <th className="px-4 py-3 font-medium">{t('admin.crm.bonus.colPeriod') || 'Period'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.crm.bonus.colSales') || 'Sales'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.crm.bonus.colActivity') || 'Activity'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.crm.bonus.colTotal') || 'Total'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.crm.bonus.colEligibility') || 'Eligibility'}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.crm.bonus.colStatus') || 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {payouts.map((payout) => {
                  const volumePct =
                    payout.volumeThreshold && payout.volumeActual
                      ? Math.round((payout.volumeActual / payout.volumeThreshold) * 100)
                      : null;
                  const prequalPct =
                    payout.prequalThreshold && payout.prequalScore
                      ? Math.round((payout.prequalScore / payout.prequalThreshold) * 100)
                      : null;

                  return (
                    <tr key={payout.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {payout.period}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {formatCurrency(payout.salesPayout)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {formatCurrency(payout.activityPayout)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(payout.totalPayout)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {volumePct !== null && (
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="w-3 h-3 text-gray-400" />
                              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${volumePct >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                  style={{ width: `${Math.min(volumePct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{volumePct}%</span>
                            </div>
                          )}
                          {prequalPct !== null && (
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-3 h-3 text-gray-400" />
                              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${prequalPct >= 100 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                  style={{ width: `${Math.min(prequalPct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{prequalPct}%</span>
                            </div>
                          )}
                          {volumePct === null && prequalPct === null && (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[payout.status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                          {payout.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
