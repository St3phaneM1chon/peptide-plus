'use client';

/**
 * Bridge cards for the Loyalty/Fidelite admin page.
 *
 * - Bridge #6:  Loyalty -> Commerce (top member orders)
 * - Bridge #37: Loyalty -> Marketing (promo usage by loyalty members)
 * - Bridge #38: Loyalty -> Community (review points summary)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Tag, MessageSquare, Loader2 } from 'lucide-react';

// --------------------------------------------------------------------------
// Types (mirrors API response shapes)
// --------------------------------------------------------------------------

interface MemberOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  date: string;
}

interface LoyaltyOrdersBridge {
  enabled: boolean;
  member?: { id: string; name: string | null };
  totalSpent?: number;
  orderCount?: number;
  recentOrders?: MemberOrder[];
}

interface PromoUsage {
  id: string;
  promoCode: string;
  promoType: string;
  promoValue: number;
  discount: number;
  userName: string | null;
  userEmail: string | null;
  userId: string;
  loyaltyPoints: number;
  date: string;
}

interface LoyaltyPromosBridge {
  enabled: boolean;
  usages?: PromoUsage[];
}

interface CommunityTx {
  id: string;
  points: number;
  description: string | null;
  userName: string | null;
  userEmail: string | null;
  userId: string;
  date: string;
}

interface LoyaltyCommunityBridge {
  enabled: boolean;
  totalPoints?: number;
  totalTransactions?: number;
  transactions?: CommunityTx[];
}

// --------------------------------------------------------------------------
// Shared skeleton
// --------------------------------------------------------------------------

function BridgeSkeleton() {
  return (
    <div className="flex items-center gap-2 animate-pulse py-2">
      <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
      <div className="h-3 bg-slate-200 rounded w-32" />
    </div>
  );
}

// --------------------------------------------------------------------------
// Bridge #37: Loyalty -> Marketing (Promos used by loyalty members)
// --------------------------------------------------------------------------

export function LoyaltyPromosBridgeCard({
  t,
  locale,
}: {
  t: (key: string) => string;
  locale: string;
}) {
  const [data, setData] = useState<LoyaltyPromosBridge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/loyalty/transactions/promos?limit=5')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data?.enabled ? json.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-orange-500" />
          {t('admin.bridges.loyaltyPromos') || 'Loyalty & Promos'}
        </h3>
        <BridgeSkeleton />
      </div>
    );
  }

  if (!data?.enabled || !data.usages || data.usages.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
        <Tag className="w-4 h-4 text-orange-500" />
        {t('admin.bridges.loyaltyPromos') || 'Loyalty & Promos'}
        <span className="ms-auto text-xs font-normal text-slate-400">
          {data.usages.length} {t('admin.bridges.usages') || 'uses'}
        </span>
      </h3>
      <div className="space-y-2">
        {data.usages.slice(0, 5).map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between text-xs p-2 rounded-md bg-orange-50"
          >
            <div className="min-w-0">
              <span className="font-medium text-orange-800">{u.userName || u.userEmail}</span>
              <span className="text-orange-500 ms-2 font-mono">{u.promoCode}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-orange-600">-${u.discount.toFixed(2)}</span>
              <span className="text-slate-400">
                {new Date(u.date).toLocaleDateString(locale)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Bridge #38: Loyalty -> Community (Review points)
// --------------------------------------------------------------------------

export function LoyaltyCommunityBridgeCard({
  t,
  locale,
}: {
  t: (key: string) => string;
  locale: string;
}) {
  const [data, setData] = useState<LoyaltyCommunityBridge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/loyalty/transactions/community?limit=5')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data?.enabled ? json.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-violet-500" />
          {t('admin.bridges.loyaltyCommunity') || 'Community Points'}
        </h3>
        <BridgeSkeleton />
      </div>
    );
  }

  if (!data?.enabled) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-violet-500" />
        {t('admin.bridges.loyaltyCommunity') || 'Community Points'}
      </h3>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-violet-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-violet-700">
            {(data.totalPoints ?? 0).toLocaleString(locale)}
          </p>
          <p className="text-[10px] text-violet-500">
            {t('admin.bridges.communityPoints') || 'Points from reviews'}
          </p>
        </div>
        <div className="bg-violet-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-violet-700">
            {(data.totalTransactions ?? 0).toLocaleString(locale)}
          </p>
          <p className="text-[10px] text-violet-500">
            {t('admin.bridges.totalReviews') || 'Total Reviews'}
          </p>
        </div>
      </div>

      {/* Recent transactions */}
      {data.transactions && data.transactions.length > 0 && (
        <div className="space-y-1.5">
          {data.transactions.slice(0, 5).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between text-xs p-2 rounded-md bg-violet-50/60"
            >
              <div className="min-w-0">
                <span className="font-medium text-violet-800">
                  {tx.userName || tx.userEmail}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-green-600">+{tx.points}</span>
                <span className="text-slate-400">
                  {new Date(tx.date).toLocaleDateString(locale)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {(!data.transactions || data.transactions.length === 0) && (data.totalPoints ?? 0) === 0 && (
        <p className="text-sm text-slate-400 italic">
          {t('admin.bridges.noReviews') || 'No review points yet'}
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Bridge #6: Loyalty -> Commerce (Top member orders) -- widget for member detail
// NOTE: This bridge requires a member userId. Rendered on member selection.
// --------------------------------------------------------------------------

export function LoyaltyOrdersBridgeCard({
  memberId,
  t,
  locale: _locale,
  formatCurrency,
}: {
  memberId: string | null;
  t: (key: string) => string;
  locale: string;
  formatCurrency?: (amount: number) => string;
}) {
  const [data, setData] = useState<LoyaltyOrdersBridge | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!memberId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/loyalty/members/${memberId}/orders`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data?.enabled ? json.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [memberId]);

  const fmt = formatCurrency || ((n: number) => `$${n.toFixed(2)}`);

  if (!memberId) return null;
  if (loading) {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-indigo-700 flex items-center gap-2 mb-2">
          <ShoppingCart className="w-4 h-4" />
          {t('admin.bridges.loyaltyOrders') || 'Member Purchases'}
        </h4>
        <BridgeSkeleton />
      </div>
    );
  }
  if (!data?.enabled || (data.orderCount ?? 0) === 0) return null;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-indigo-700 flex items-center gap-2 mb-2">
        <ShoppingCart className="w-4 h-4" />
        {t('admin.bridges.loyaltyOrders') || 'Member Purchases'}
      </h4>
      <div className="flex gap-4 text-sm mb-3">
        <div>
          <span className="text-indigo-600">{t('admin.bridges.totalOrders') || 'Total Orders'}: </span>
          <span className="font-bold text-indigo-800">{data.orderCount}</span>
        </div>
        <div>
          <span className="text-indigo-600">{t('admin.bridges.totalSpent') || 'Total Spent'}: </span>
          <span className="font-bold text-green-700">{fmt(data.totalSpent ?? 0)}</span>
        </div>
      </div>
      {data.recentOrders && data.recentOrders.length > 0 && (
        <div className="space-y-1.5">
          {data.recentOrders.slice(0, 5).map((order) => (
            <Link
              key={order.id}
              href={`/admin/commandes?order=${order.id}`}
              className="flex items-center justify-between text-xs p-2 rounded-md bg-indigo-100/50 hover:bg-indigo-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-indigo-700">{order.orderNumber}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    order.status === 'DELIVERED'
                      ? 'bg-green-100 text-green-700'
                      : order.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <span className="font-mono text-indigo-700">{fmt(order.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
