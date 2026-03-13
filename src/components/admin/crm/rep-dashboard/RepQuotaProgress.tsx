'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Target,
  Loader2,
  ClipboardList,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface Quota {
  id: string;
  targetType: string;
  target: number;
  actual: number;
  period: string;
}

interface RepQuotaProgressProps {
  agentId: string;
  period: string;
}

// ── Color helpers ───────────────────────────────────────────────

function getProgressColor(pct: number): { bar: string; text: string } {
  if (pct >= 100) return { bar: 'bg-green-500', text: 'text-green-600 dark:text-green-400' };
  if (pct >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' };
  return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
}

// ── Component ───────────────────────────────────────────────────

export default function RepQuotaProgress({ agentId, period }: RepQuotaProgressProps) {
  const { t, locale } = useI18n();
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchQuotas() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/crm/reps/${agentId}/dashboard?section=quotas&period=${period}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setQuotas(json.data ?? json ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load quotas');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQuotas();
    return () => { cancelled = true; };
  }, [agentId, period]);

  const formatNumber = (val: number) =>
    new Intl.NumberFormat(locale || 'en').format(val);

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

  if (quotas.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
        <ClipboardList className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          {t('admin.crm.quotas.empty') || 'No quotas configured for this period.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <Target className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('admin.crm.quotas.title') || 'Quota Progress'}
        </h3>
      </div>

      {/* Quota list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700 p-4 space-y-4">
        {quotas.map((quota) => {
          const pct = quota.target > 0 ? Math.round((quota.actual / quota.target) * 100) : 0;
          const barPct = Math.min(pct, 100);
          const { bar, text } = getProgressColor(pct);

          return (
            <div key={quota.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {quota.targetType}
                  </span>
                  {quota.period && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      ({quota.period})
                    </span>
                  )}
                </div>
                <span className={`text-sm font-bold ${text}`}>
                  {pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${bar}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>

              {/* Actual / Target */}
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatNumber(quota.actual)} / {formatNumber(quota.target)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
