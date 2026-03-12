'use client';

/**
 * Bridge cards for the Email admin module.
 *
 * - Bridge #12: Email -> CRM (CRM deals for email recipient) -- already in CustomerSidebar
 * - Bridge #43: Email -> Commerce (orders for email recipient)
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Briefcase } from 'lucide-react';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface EmailOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentStatus: string;
  date: string;
}

interface EmailOrdersBridge {
  enabled: boolean;
  orders?: EmailOrder[];
}

interface EmailCrmDeal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  isWon: boolean;
  isLost: boolean;
  date: string;
}

interface EmailCrmBridge {
  enabled: boolean;
  deals?: EmailCrmDeal[];
  leads?: Array<{ id: string; status: string; source: string; date: string }>;
}

// --------------------------------------------------------------------------
// Bridge #43: Email -> Commerce (sidebar widget)
// --------------------------------------------------------------------------

export function EmailOrdersSidebarWidget({
  emailId,
  t,
  locale: _locale,
}: {
  emailId: string | null;
  t: (key: string) => string;
  locale: string;
}) {
  const [data, setData] = useState<EmailOrdersBridge | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!emailId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/emails/${emailId}/orders`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data?.enabled ? json.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [emailId]);

  if (!emailId || loading) return null;
  if (!data?.enabled || !data.orders || data.orders.length === 0) return null;

  return (
    <div className="p-4 border-b border-slate-100">
      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
        <ShoppingBag className="h-3 w-3" />
        {t('admin.bridges.emailOrders') || 'Recipient Orders'}
      </h4>
      <div className="space-y-1.5">
        {data.orders.slice(0, 3).map((order) => (
          <Link
            key={order.id}
            href={`/admin/commandes?order=${order.id}`}
            className="flex items-center justify-between text-xs hover:bg-slate-50 rounded p-1 transition-colors"
          >
            <div>
              <span className="font-medium text-slate-900">#{order.orderNumber}</span>
              <span
                className={`ms-2 text-[10px] px-1.5 py-0.5 rounded ${
                  order.status === 'DELIVERED'
                    ? 'bg-green-100 text-green-700'
                    : order.status === 'SHIPPED'
                      ? 'bg-indigo-100 text-indigo-700'
                      : order.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-600'
                }`}
              >
                {order.status}
              </span>
            </div>
            <span className="text-slate-600">{Number(order.total).toFixed(2)}$</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Bridge #12: Email -> CRM (sidebar widget)
// This is used when we have an emailId, fetching CRM deals for the recipient.
// --------------------------------------------------------------------------

export function EmailCrmSidebarWidget({
  emailId,
  t,
}: {
  emailId: string | null;
  t: (key: string) => string;
}) {
  const [data, setData] = useState<EmailCrmBridge | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!emailId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/emails/${emailId}/crm`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json?.data?.enabled ? json.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [emailId]);

  if (!emailId || loading) return null;
  if (!data?.enabled) return null;

  const hasDeals = data.deals && data.deals.length > 0;
  const hasLeads = data.leads && data.leads.length > 0;
  if (!hasDeals && !hasLeads) return null;

  return (
    <div className="p-4 border-b border-slate-100">
      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
        <Briefcase className="h-3 w-3" />
        {t('admin.bridges.emailCrm') || 'Recipient CRM Deals'}
      </h4>
      {hasDeals && (
        <div className="space-y-1.5">
          {data.deals!.slice(0, 3).map((deal) => (
            <Link
              key={deal.id}
              href={`/admin/crm/deals/${deal.id}`}
              className="flex items-center justify-between text-xs hover:bg-slate-50 rounded p-1 transition-colors"
            >
              <span className="font-medium text-slate-800 truncate">{deal.title}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  deal.isWon
                    ? 'bg-green-100 text-green-700'
                    : deal.isLost
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {deal.stage}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
