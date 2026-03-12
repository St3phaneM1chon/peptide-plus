'use client';

/**
 * CustomerStatsWidget — Bridge: Customer 360 (aggregated cross-module)
 *
 * Shows key customer metrics: total orders, total spent, loyalty points,
 * last order date, and health score. Pulls data from the Customer 360 API.
 */

import { useState, useEffect } from 'react';
import {
  User, ShoppingCart, DollarSign, Award, CalendarDays,
  Heart,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Customer360Data {
  user: {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
  };
  healthScore: number;
  modules: {
    commerce?: {
      enabled: boolean;
      totalOrders?: number;
      totalSpent?: number;
      recentOrders?: Array<{ createdAt: string }>;
    };
    loyalty?: {
      enabled: boolean;
      currentTier?: string;
      currentPoints?: number;
      lifetimePoints?: number;
    };
  };
}

// ---------------------------------------------------------------------------
// Health score colour
// ---------------------------------------------------------------------------

function healthColor(score: number): string {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 60) return 'text-amber-600 bg-amber-50';
  if (score >= 40) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomerStatsWidget({
  customerId,
  t,
  locale,
  formatCurrency,
}: {
  customerId: string | null;
  t: (key: string) => string;
  locale: string;
  formatCurrency?: (amount: number) => string;
}) {
  const [data, setData] = useState<Customer360Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fmt = formatCurrency || ((n: number) => `$${n.toFixed(2)}`);

  useEffect(() => {
    if (!customerId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(false);
    fetch(`/api/admin/customers/${customerId}/360?modules=ecommerce,loyalty`)
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
  }, [customerId]);

  // ── No customer selected ────────────────────────────────────
  if (!customerId) return null;

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-indigo-500" />
          {t('admin.bridges.customerStats') || 'Customer Stats'}
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

  // ── Error state ─────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-indigo-500" />
          {t('admin.bridges.customerStats') || 'Customer Stats'}
        </h3>
        <p className="text-sm text-slate-400 italic">
          {t('admin.bridges.noData') || 'No data available'}
        </p>
      </div>
    );
  }

  // ── Extract data ────────────────────────────────────────────
  const commerce = data.modules.commerce;
  const loyalty = data.modules.loyalty;
  const totalOrders = commerce?.totalOrders ?? 0;
  const totalSpent = commerce?.totalSpent ?? 0;
  const currentPoints = loyalty?.currentPoints ?? 0;
  const lastOrderDate = commerce?.recentOrders?.[0]?.createdAt;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
        <User className="w-4 h-4 text-indigo-500" />
        {t('admin.bridges.customerStats') || 'Customer Stats'}
        {/* Health score badge */}
        <span className={`ms-auto text-xs font-bold px-2 py-0.5 rounded-full ${healthColor(data.healthScore)}`}>
          <Heart className="w-3 h-3 inline-block mr-0.5 -mt-0.5" />
          {data.healthScore}
        </span>
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Total Orders */}
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-lg font-bold text-blue-700">
            {totalOrders.toLocaleString(locale)}
          </p>
          <p className="text-[10px] text-blue-500">
            {t('admin.bridges.totalOrders') || 'Total orders'}
          </p>
        </div>

        {/* Total Spent */}
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-green-500" />
          </div>
          <p className="text-lg font-bold text-green-700">
            {fmt(totalSpent)}
          </p>
          <p className="text-[10px] text-green-500">
            {t('admin.bridges.totalSpent') || 'Total spent'}
          </p>
        </div>

        {/* Loyalty Points */}
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Award className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <p className="text-lg font-bold text-purple-700">
            {currentPoints.toLocaleString(locale)}
          </p>
          <p className="text-[10px] text-purple-500">
            {t('admin.bridges.points') || 'Points'}
          </p>
        </div>

        {/* Last Order Date */}
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <p className="text-sm font-bold text-slate-700">
            {lastOrderDate
              ? new Date(lastOrderDate).toLocaleDateString(locale)
              : '-'}
          </p>
          <p className="text-[10px] text-slate-500">
            {t('admin.bridges.lastOrder') || 'Last order'}
          </p>
        </div>
      </div>
    </div>
  );
}
