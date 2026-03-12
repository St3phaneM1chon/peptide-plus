'use client';

/**
 * LoyaltyBadgeWidget — Bridge #15: CRM -> Loyalty
 *
 * Shows a customer's loyalty tier and points balance.
 * Compact badge designed to be placed in headers, sidebars, or detail cards.
 * Fetches loyalty data from the Customer 360 API.
 */

import { useState, useEffect } from 'react';
import { Award, Loader2, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Tier visuals
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<string, { bg: string; text: string; badge: string; icon: string }> = {
  BRONZE:   { bg: 'bg-orange-50',  text: 'text-orange-700',  badge: 'bg-orange-100 border-orange-200',  icon: 'text-orange-500' },
  SILVER:   { bg: 'bg-slate-50',   text: 'text-slate-700',   badge: 'bg-slate-100 border-slate-200',    icon: 'text-slate-500' },
  GOLD:     { bg: 'bg-yellow-50',  text: 'text-yellow-700',  badge: 'bg-yellow-100 border-yellow-300',  icon: 'text-yellow-500' },
  PLATINUM: { bg: 'bg-blue-50',    text: 'text-blue-700',    badge: 'bg-blue-100 border-blue-200',      icon: 'text-blue-500' },
  DIAMOND:  { bg: 'bg-purple-50',  text: 'text-purple-700',  badge: 'bg-purple-100 border-purple-200',  icon: 'text-purple-500' },
};

const DEFAULT_STYLE = TIER_STYLES.BRONZE;

// Tier thresholds (same as src/lib/constants.ts LOYALTY_TIER_THRESHOLDS)
const TIER_THRESHOLDS = [
  { id: 'BRONZE',   minPoints: 0 },
  { id: 'SILVER',   minPoints: 500 },
  { id: 'GOLD',     minPoints: 2000 },
  { id: 'PLATINUM', minPoints: 5000 },
  { id: 'DIAMOND',  minPoints: 10000 },
];

function getNextTier(currentTier: string): { name: string; pointsNeeded: number; threshold: number } | null {
  const idx = TIER_THRESHOLDS.findIndex((t) => t.id === currentTier);
  const next = TIER_THRESHOLDS[idx + 1];
  if (!next) return null;
  return { name: next.id, pointsNeeded: 0, threshold: next.minPoints };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoyaltyData {
  currentTier: string;
  currentPoints: number;
  lifetimePoints: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoyaltyBadgeWidget({
  customerId,
  t,
  locale,
}: {
  customerId: string | null;
  t: (key: string) => string;
  locale: string;
}) {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(false);
    fetch(`/api/admin/customers/${customerId}/360?modules=loyalty`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const loyalty = json?.data?.modules?.loyalty;
        if (loyalty?.enabled) {
          setData({
            currentTier: loyalty.currentTier ?? 'BRONZE',
            currentPoints: loyalty.currentPoints ?? 0,
            lifetimePoints: loyalty.lifetimePoints ?? 0,
          });
        } else {
          setData(null);
        }
      })
      .catch(() => {
        setData(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  // ── No customer ─────────────────────────────────────────────
  if (!customerId) return null;

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-purple-500" />
          {t('admin.bridges.loyaltyInfo') || 'Loyalty'}
        </h3>
        <div className="flex items-center gap-2 animate-pulse py-2">
          <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
          <div className="h-3 bg-slate-200 rounded w-24" />
        </div>
      </div>
    );
  }

  // ── Error / no data ─────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-purple-500" />
          {t('admin.bridges.loyaltyInfo') || 'Loyalty'}
        </h3>
        <p className="text-sm text-slate-400 italic">
          {t('admin.bridges.noData') || 'No data available'}
        </p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────
  const tier = data.currentTier.toUpperCase();
  const style = TIER_STYLES[tier] || DEFAULT_STYLE;
  const nextTier = getNextTier(tier);
  const pointsToNext = nextTier ? nextTier.threshold - data.lifetimePoints : 0;
  const progress = nextTier
    ? Math.min(100, Math.round((data.lifetimePoints / nextTier.threshold) * 100))
    : 100;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
        <Award className={`w-4 h-4 ${style.icon}`} />
        {t('admin.bridges.loyaltyInfo') || 'Loyalty'}
      </h3>

      {/* Tier badge */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${style.badge} ${style.bg} mb-4`}>
        <Award className={`w-6 h-6 ${style.icon}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${style.text}`}>{tier}</p>
          <p className="text-xs text-slate-500">
            {data.currentPoints.toLocaleString(locale)} {t('admin.bridges.points') || 'Points'}
          </p>
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && pointsToNext > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>{tier}</span>
            <span className="flex items-center gap-0.5">
              <ChevronRight className="w-3 h-3" />
              {nextTier.name}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                tier === 'DIAMOND' ? 'bg-purple-500'
                : tier === 'PLATINUM' ? 'bg-blue-500'
                : tier === 'GOLD' ? 'bg-yellow-500'
                : tier === 'SILVER' ? 'bg-slate-400'
                : 'bg-orange-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-center">
            {pointsToNext.toLocaleString(locale)} {t('admin.bridges.pointsToNext') || 'points to next tier'}
          </p>
        </div>
      )}

      {/* Already at max tier */}
      {!nextTier && (
        <p className="text-[10px] text-center text-purple-500 font-medium">
          {t('admin.bridges.maxTier') || 'Maximum tier reached!'}
        </p>
      )}
    </div>
  );
}
