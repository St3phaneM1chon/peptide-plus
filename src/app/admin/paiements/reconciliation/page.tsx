'use client';

import { useState, useCallback } from 'react';
import {
  Loader2,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Receipt,
  RefreshCw,
  FileDown,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────

interface ReconciliationReport {
  period: { from: string; to: string };
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalRefunded: number;
    netRevenue: number;
    paymentErrors: number;
    matchedWithStripe: number;
    unmatchedOrders: number;
  };
  unmatched: {
    orderNumber: string;
    total: number;
    status: string;
    date: string;
  }[];
}

// ── Main Component ────────────────────────────────────────────

export default function ReconciliationPage() {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReconciliationReport | null>(null);

  // Date range state - default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [fromDate, setFromDate] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) params.set('to', new Date(toDate + 'T23:59:59').toISOString());

      const res = await fetch(`/api/admin/payments/reconciliation?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to fetch reconciliation report');
        return;
      }
      const data = await res.json();
      setReport(data);
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, t]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });

  const handleExportCSV = () => {
    if (!report) return;
    const BOM = '\uFEFF';
    const headers = ['Order Number', 'Total', 'Payment Status', 'Date'];
    const rows = report.unmatched.map(u => [
      u.orderNumber,
      u.total.toFixed(2),
      u.status,
      formatDate(u.date),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${fromDate}-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported successfully');
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      PAID: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
      REFUNDED: { bg: 'bg-red-100', text: 'text-red-700' },
      PARTIALLY_REFUNDED: { bg: 'bg-amber-100', text: 'text-amber-700' },
    };
    const s = map[status] || { bg: 'bg-slate-100', text: 'text-slate-700' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payment Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Compare order totals against Stripe payments for a given period
          </p>
        </div>
      </div>

      {/* Date range selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="flex items-center pb-1">
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-9 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <Button
            variant="primary"
            icon={RefreshCw}
            size="sm"
            onClick={fetchReport}
            loading={loading}
          >
            Generate Report
          </Button>
          {report && (
            <Button
              variant="secondary"
              icon={FileDown}
              size="sm"
              onClick={handleExportCSV}
              disabled={report.unmatched.length === 0}
            >
              Export Unmatched
            </Button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center h-48" role="status">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
          <span className="sr-only">Loading...</span>
        </div>
      )}

      {/* No report yet */}
      {!loading && !report && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No report generated yet</h3>
          <p className="text-sm text-slate-500 mb-4">
            Select a date range and click &quot;Generate Report&quot; to view the reconciliation data.
          </p>
        </div>
      )}

      {/* Report results */}
      {!loading && report && (
        <>
          {/* Period info */}
          <div className="text-sm text-slate-500">
            Report period: <span className="font-medium text-slate-700">{formatDate(report.period.from)}</span>
            {' '}&rarr;{' '}
            <span className="font-medium text-slate-700">{formatDate(report.period.to)}</span>
          </div>

          {/* Summary stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Total Orders" value={report.summary.totalOrders} icon={Receipt} />
            <StatCard label="Total Revenue" value={formatCurrency(report.summary.totalRevenue)} icon={DollarSign} />
            <StatCard label="Total Refunded" value={formatCurrency(report.summary.totalRefunded)} icon={RefreshCw} />
            <StatCard label="Net Revenue" value={formatCurrency(report.summary.netRevenue)} icon={TrendingUp} />
            <StatCard label="Payment Errors" value={report.summary.paymentErrors} icon={AlertTriangle} />
            <StatCard label="Matched (Stripe)" value={report.summary.matchedWithStripe} icon={DollarSign} />
            <StatCard label="Unmatched" value={report.summary.unmatchedOrders} icon={AlertTriangle} />
          </div>

          {/* Revenue breakdown visual */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Revenue Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(report.summary.totalRevenue)}</p>
                <p className="text-sm text-emerald-600 mt-1">Gross Revenue</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">-{formatCurrency(report.summary.totalRefunded)}</p>
                <p className="text-sm text-red-600 mt-1">Refunded</p>
              </div>
              <div className="text-center p-4 bg-teal-50 rounded-lg">
                <p className="text-2xl font-bold text-teal-700">{formatCurrency(report.summary.netRevenue)}</p>
                <p className="text-sm text-teal-600 mt-1">Net Revenue</p>
              </div>
            </div>
          </div>

          {/* Stripe match rate */}
          {report.summary.totalOrders > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Stripe Match Rate</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{
                      width: `${Math.round((report.summary.matchedWithStripe / report.summary.totalOrders) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-700 w-16 text-right">
                  {Math.round((report.summary.matchedWithStripe / report.summary.totalOrders) * 100)}%
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {report.summary.matchedWithStripe} of {report.summary.totalOrders} orders matched with Stripe payment IDs
              </p>
            </div>
          )}

          {/* Unmatched orders table */}
          {report.unmatched.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Unmatched Orders</h3>
                  <p className="text-sm text-slate-500">
                    {report.unmatched.length} order(s) without a Stripe payment ID
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">Requires attention</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Order Number</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Total</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Payment Status</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-600">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.unmatched.map((order, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-mono text-sm font-medium text-slate-900">
                          {order.orderNumber}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-6 py-3">
                        {statusBadge(order.status)}
                      </td>
                      <td className="px-6 py-3 text-slate-600">
                        {formatDate(order.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* All clear message */}
          {report.unmatched.length === 0 && report.summary.totalOrders > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
              <DollarSign className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-emerald-900">All payments reconciled</h3>
              <p className="text-sm text-emerald-700 mt-1">
                All {report.summary.totalOrders} orders have matching Stripe payment IDs.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
