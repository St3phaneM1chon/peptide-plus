'use client';

/**
 * AccountingSummaryWidget — Bridge #18: Dashboard -> All (Accounting slice)
 *
 * Shows a compact accounting summary for the current period:
 * - Draft entries count
 * - Entries this month
 * - Revenue today (from Commerce cross-module data)
 * - Pending orders count
 *
 * Fetches from the cross-module dashboard API.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calculator, FileText, TrendingUp, Clock, DollarSign } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (mirroring cross-module dashboard response)
// ---------------------------------------------------------------------------

interface CrossModuleData {
  modules: {
    accounting?: {
      draftEntries: number;
      entriesThisMonth: number;
    };
    commerce?: {
      ordersToday: number;
      revenueToday: number;
      pendingOrders: number;
    };
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountingSummaryWidget({
  period = 'month',
  t,
  locale,
  formatCurrency,
}: {
  period?: 'month' | 'quarter' | 'year';
  t: (key: string) => string;
  locale: string;
  formatCurrency?: (amount: number) => string;
}) {
  const [data, setData] = useState<CrossModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fmt = formatCurrency || ((n: number) => `$${n.toFixed(2)}`);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch('/api/admin/dashboard/cross-module')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => setData(json?.data ?? null))
      .catch(() => {
        setData(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Period label ────────────────────────────────────────────
  const periodLabel = period === 'year'
    ? (t('admin.bridges.thisYear') || 'This year')
    : period === 'quarter'
      ? (t('admin.bridges.thisQuarter') || 'This quarter')
      : (t('admin.bridges.thisMonth') || 'This month');

  // ── Loading skeleton ────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
          <Calculator className="w-4 h-4 text-emerald-500" />
          {t('admin.bridges.accountingSummary') || 'Accounting Summary'}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-slate-50 rounded-lg p-3">
              <div className="h-5 bg-slate-200 rounded w-12 mb-1" />
              <div className="h-3 bg-slate-100 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error / no data ─────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-emerald-500" />
          {t('admin.bridges.accountingSummary') || 'Accounting Summary'}
        </h3>
        <p className="text-sm text-slate-400 italic">
          {t('admin.bridges.noData') || 'No data available'}
        </p>
      </div>
    );
  }

  const accounting = data.modules.accounting;
  const commerce = data.modules.commerce;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-emerald-500" />
        {t('admin.bridges.accountingSummary') || 'Accounting Summary'}
      </h3>
      <p className="text-[10px] text-slate-400 mb-4">{periodLabel}</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Revenue Today */}
        {commerce && (
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <DollarSign className="w-4 h-4 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-700">
              {fmt(commerce.revenueToday)}
            </p>
            <p className="text-[10px] text-green-500">
              {t('admin.bridges.revenueToday') || 'Revenue today'}
            </p>
          </div>
        )}

        {/* Entries This Month */}
        {accounting && (
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-emerald-700">
              {accounting.entriesThisMonth.toLocaleString(locale)}
            </p>
            <p className="text-[10px] text-emerald-500">
              {t('admin.bridges.recentEntries') || 'Recent Entries'}
            </p>
          </div>
        )}

        {/* Draft Entries */}
        {accounting && (
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <FileText className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-amber-700">
              {accounting.draftEntries.toLocaleString(locale)}
            </p>
            <p className="text-[10px] text-amber-500">
              {t('admin.bridges.draftEntries') || 'Draft entries'}
            </p>
          </div>
        )}

        {/* Pending Orders */}
        {commerce && (
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <Clock className="w-4 h-4 text-slate-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-700">
              {commerce.pendingOrders.toLocaleString(locale)}
            </p>
            <p className="text-[10px] text-slate-500">
              {t('admin.bridges.pendingOrders') || 'Pending orders'}
            </p>
          </div>
        )}
      </div>

      {/* Link to full accounting */}
      <Link
        href="/admin/comptabilite"
        className="mt-3 block text-center text-xs text-indigo-600 hover:text-indigo-700 py-1"
      >
        {t('admin.bridges.viewAll') || 'View all'}
      </Link>
    </div>
  );
}
