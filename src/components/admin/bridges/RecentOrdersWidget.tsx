'use client';

/**
 * RecentOrdersWidget — Bridge #1-2: CRM -> Commerce (Purchase History)
 *
 * Shows the last N orders for a given customer. Designed to be embedded
 * in any admin detail page (customer 360, CRM deal, etc.).
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Loader2, PackageOpen } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

interface PurchaseHistoryData {
  enabled: boolean;
  recentOrders?: WidgetOrder[];
  totalOrders?: number;
  totalSpent?: number;
}

// ---------------------------------------------------------------------------
// Status badge colour mapping
// ---------------------------------------------------------------------------

function statusColor(status: string) {
  switch (status) {
    case 'DELIVERED':
      return 'bg-green-100 text-green-700';
    case 'SHIPPED':
      return 'bg-blue-100 text-blue-700';
    case 'PROCESSING':
      return 'bg-amber-100 text-amber-700';
    case 'CANCELLED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecentOrdersWidget({
  customerId,
  limit = 5,
  t,
  locale,
  formatCurrency,
}: {
  customerId: string | null;
  limit?: number;
  t: (key: string) => string;
  locale: string;
  formatCurrency?: (amount: number) => string;
}) {
  const [data, setData] = useState<PurchaseHistoryData | null>(null);
  const [loading, setLoading] = useState(false);

  const fmt = formatCurrency || ((n: number) => `$${n.toFixed(2)}`);

  useEffect(() => {
    if (!customerId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/customers/${customerId}/360?modules=ecommerce`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const commerce = json?.data?.modules?.commerce;
        if (commerce?.enabled) {
          setData(commerce);
        } else {
          setData(null);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [customerId]);

  // ── No customer selected ───────────────────────────────────────
  if (!customerId) return null;

  // ── Loading skeleton ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-blue-500" />
          {t('admin.bridges.recentOrders') || 'Recent orders'}
        </h3>
        <div className="flex items-center gap-2 animate-pulse py-2">
          <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
          <div className="h-3 bg-slate-200 rounded w-32" />
        </div>
      </div>
    );
  }

  // ── No data / module disabled ─────────────────────────────────
  if (!data?.enabled || !data.recentOrders || data.recentOrders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-blue-500" />
          {t('admin.bridges.recentOrders') || 'Recent orders'}
        </h3>
        <div className="flex items-center gap-3 py-4 text-slate-400">
          <PackageOpen className="w-5 h-5" />
          <p className="text-sm italic">
            {t('admin.bridges.noOrders') || 'No orders'}
          </p>
        </div>
      </div>
    );
  }

  // ── Render orders ─────────────────────────────────────────────
  const orders = data.recentOrders.slice(0, limit);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
        <ShoppingCart className="w-4 h-4 text-blue-500" />
        {t('admin.bridges.recentOrders') || 'Recent orders'}
        <span className="ms-auto text-xs font-normal text-slate-400">
          {data.totalOrders ?? orders.length} {t('admin.bridges.totalOrders') || 'Total orders'}
        </span>
      </h3>

      <div className="space-y-1.5">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/admin/commandes?order=${order.id}`}
            className="flex items-center justify-between text-xs p-2 rounded-md bg-blue-50/60 hover:bg-blue-100/60 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-medium text-blue-700">
                #{order.orderNumber}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor(order.status)}`}
              >
                {order.status}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-slate-700">{fmt(order.total)}</span>
              <span className="text-slate-400">
                {new Date(order.createdAt).toLocaleDateString(locale)}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {(data.totalOrders ?? 0) > limit && (
        <Link
          href={`/admin/commandes?customer=${customerId}`}
          className="mt-3 block text-center text-xs text-indigo-600 hover:text-indigo-700 py-1"
        >
          {t('admin.bridges.viewAll') || 'View all'}
        </Link>
      )}
    </div>
  );
}
