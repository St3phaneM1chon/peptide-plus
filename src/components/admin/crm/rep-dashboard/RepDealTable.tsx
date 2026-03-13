'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '@/i18n/client';
import {
  ArrowUpDown,
  Loader2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface DealStage {
  name: string;
  isWon?: boolean;
  isLost?: boolean;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  pipeline?: { name: string } | null;
  expectedCloseDate?: string | null;
}

interface PaginatedDeals {
  data: Deal[];
  total: number;
  page: number;
  pageSize: number;
}

interface RepDealTableProps {
  agentId: string;
  period: string;
}

// ── Status helpers ──────────────────────────────────────────────

type DealStatus = 'won' | 'lost' | 'open';

function getDealStatus(stage: DealStage): DealStatus {
  if (stage.isWon) return 'won';
  if (stage.isLost) return 'lost';
  return 'open';
}

const STATUS_BADGES: Record<DealStatus, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const FILTERS = [
  { key: 'all', label: 'All', labelKey: 'common.all' },
  { key: 'open', label: 'Open', labelKey: 'admin.crm.deals.open' },
  { key: 'won', label: 'Won', labelKey: 'admin.crm.deals.won' },
  { key: 'lost', label: 'Lost', labelKey: 'admin.crm.deals.lost' },
] as const;

const PAGE_SIZE = 10;

// ── Component ───────────────────────────────────────────────────

export default function RepDealTable({ agentId, period }: RepDealTableProps) {
  const { t, locale } = useI18n();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'value' | 'date'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/crm/reps/${agentId}/dashboard?section=deals&period=${period}&page=${page}&pageSize=${PAGE_SIZE}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PaginatedDeals = await res.json();
      setDeals(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [agentId, period, page]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Filter & sort client-side (within current page)
  const filteredDeals = useMemo(() => {
    let result = [...deals];

    if (filter !== 'all') {
      result = result.filter((d) => getDealStatus(d.stage) === filter);
    }

    result.sort((a, b) => {
      if (sortBy === 'value') {
        return sortDir === 'desc' ? b.value - a.value : a.value - b.value;
      }
      const dateA = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
      const dateB = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
      return sortDir === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [deals, filter, sortBy, sortDir]);

  const toggleSort = (col: 'value' | 'date') => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(locale || 'en', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
      {/* Header with filter buttons */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('admin.crm.deals.title') || 'Deals'}
        </h3>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t(f.labelKey) || f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-500 dark:text-gray-400">{t('common.loading') || 'Loading...'}</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('admin.crm.deals.empty') || 'No deals found.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                <th className="px-4 py-3 font-medium">{t('admin.crm.deals.colTitle') || 'Title'}</th>
                <th className="px-4 py-3 font-medium">
                  <button onClick={() => toggleSort('value')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300">
                    {t('admin.crm.deals.colValue') || 'Value'}
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">{t('admin.crm.deals.colStage') || 'Stage'}</th>
                <th className="px-4 py-3 font-medium">{t('admin.crm.deals.colPipeline') || 'Pipeline'}</th>
                <th className="px-4 py-3 font-medium">
                  <button onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300">
                    {t('admin.crm.deals.colExpectedClose') || 'Expected Close'}
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">{t('admin.crm.deals.colStatus') || 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {filteredDeals.map((deal) => {
                const status = getDealStatus(deal.stage);
                return (
                  <tr key={deal.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {deal.title}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {formatCurrency(deal.value)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {deal.stage.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {deal.pipeline?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(deal.expectedCloseDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGES[status]}`}>
                        {t(`admin.crm.deals.status.${status}`) || status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('common.page') || 'Page'} {page} / {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
