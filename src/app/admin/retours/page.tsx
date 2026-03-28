/**
 * ADMIN - Returns & Exchanges Management
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  Package,
  Check,
  X,
  Clock,
  ArrowRightLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquare,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatCard,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

interface ReturnRequest {
  id: string;
  orderItemId: string;
  orderId: string;
  userId: string;
  reason: string;
  details: string | null;
  status: string;
  resolution: string | null;
  adminNotes: string | null;
  items: unknown[] | null;
  refundAmount: number | null;
  exchangeFor: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    total: number | null;
    status: string;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  refunds: Array<{
    id: string;
    amount: number;
    status: string;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: Check },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: X },
  COMPLETED: { label: 'Completed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Package },
  EXCHANGE: { label: 'Exchange', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: ArrowRightLeft },
};

export default function RetoursPage() {
  const { t, formatCurrency } = useI18n();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Update form state
  const [updateStatus, setUpdateStatus] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateRefundAmount, setUpdateRefundAmount] = useState('');
  const [updateTrackingNumber, setUpdateTrackingNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/returns?${params}`);
      const data = await res.json();
      if (data.success) {
        setReturns(data.returns || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch {
      toast.error(t('admin.returns.loadError'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, t]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const openDetail = useCallback((r: ReturnRequest) => {
    setSelectedReturn(r);
    setUpdateStatus(r.status);
    setUpdateNotes(r.adminNotes || '');
    setUpdateRefundAmount(r.refundAmount !== null ? String(r.refundAmount) : '');
    setUpdateTrackingNumber(r.trackingNumber || '');
    setDetailOpen(true);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!selectedReturn) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/returns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          id: selectedReturn.id,
          status: updateStatus || undefined,
          adminNotes: updateNotes || undefined,
          refundAmount: updateRefundAmount ? parseFloat(updateRefundAmount) : undefined,
          trackingNumber: updateTrackingNumber || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.returns.updated'));
        setDetailOpen(false);
        fetchReturns();
      } else {
        toast.error(data.error?.message || t('admin.returns.updateError'));
      }
    } catch {
      toast.error(t('admin.returns.updateError'));
    } finally {
      setSaving(false);
    }
  }, [selectedReturn, updateStatus, updateNotes, updateRefundAmount, updateTrackingNumber, t, fetchReturns]);

  useRibbonAction('refresh', fetchReturns);

  const pendingCount = returns.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.returns.title')}
        subtitle={t('admin.returns.description')}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.returns.totalReturns')}
          value={String(total)}
          icon={RotateCcw}
        />
        <StatCard
          label={t('admin.returns.pending')}
          value={String(pendingCount)}
          icon={Clock}
          trend={pendingCount > 0 ? { value: 1 } : undefined}
        />
        <StatCard
          label={t('admin.returns.approved')}
          value={String(returns.filter((r) => r.status === 'APPROVED').length)}
          icon={Check}
        />
        <StatCard
          label={t('admin.returns.completed')}
          value={String(returns.filter((r) => r.status === 'COMPLETED').length)}
          icon={Package}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">{t('admin.returns.allStatuses')}</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : returns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <RotateCcw className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('admin.returns.noReturns')}
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t('admin.returns.noReturnsHint')}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('admin.returns.order')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('admin.returns.customer')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('admin.returns.reason')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.status')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('admin.returns.refund')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">{t('common.date')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {returns.map((r) => {
                  const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{r.order?.orderNumber || r.orderId.slice(0, 8)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{r.user?.name || '-'}</p>
                          <p className="text-xs text-gray-500">{r.user?.email || ''}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-gray-600 dark:text-gray-400">
                        {r.reason}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                        {r.refundAmount !== null ? formatCurrency(r.refundAmount) : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openDetail(r)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('common.view')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {t('common.page')} {page} / {totalPages} ({total} {t('common.total')})
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  icon={ChevronLeft}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  icon={ChevronRight}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={t('admin.returns.returnDetails')}
      >
        {selectedReturn && (
          <div className="space-y-4 p-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">{t('admin.returns.order')}:</span>
                <p className="font-mono font-medium">{selectedReturn.order?.orderNumber || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">{t('admin.returns.customer')}:</span>
                <p className="font-medium">{selectedReturn.user?.name || selectedReturn.user?.email || '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">{t('admin.returns.reason')}:</span>
                <p className="mt-1">{selectedReturn.reason}</p>
                {selectedReturn.details && (
                  <p className="mt-1 text-gray-600 dark:text-gray-400">{selectedReturn.details}</p>
                )}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('common.status')}
              </label>
              <select
                value={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>

            {/* Refund Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.returns.refundAmount')}
              </label>
              <input
                type="number"
                value={updateRefundAmount}
                onChange={(e) => setUpdateRefundAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            {/* Tracking Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.returns.trackingNumber')}
              </label>
              <input
                type="text"
                value={updateTrackingNumber}
                onChange={(e) => setUpdateTrackingNumber(e.target.value)}
                placeholder="e.g. CP123456789CA"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <MessageSquare className="mr-1 inline h-3.5 w-3.5" />
                {t('admin.returns.adminNotes')}
              </label>
              <textarea
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleUpdate} loading={saving} icon={Check}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
