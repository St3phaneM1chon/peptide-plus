'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Search, Plus, DollarSign, LayoutGrid, List, Trash2,
  X, TrendingUp, Target, Clock,
} from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  value: number | string;
  currency: string;
  stage: { id: string; name: string; color: string | null; probability: number };
  assignedTo: { id: string; name: string | null; email: string };
  lead?: { id: string; contactName: string } | null;
  contact?: { id: string; name: string | null; email: string } | null;
  tags: string[];
  expectedCloseDate?: string | null;
  createdAt: string;
}

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; color: string | null; position: number }[];
}

interface DealStats {
  totalDeals: number;
  totalValue: number;
  weightedValue: number;
  winRate: number;
  wonCount: number;
  lostCount: number;
  openCount: number;
}

export default function DealsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stats, setStats] = useState<DealStats | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const limit = 20;

  // Fetch pipelines for filter
  useEffect(() => {
    fetch('/api/admin/crm/pipelines')
      .then(r => r.json())
      .then(json => {
        if (json.success) setPipelines(json.data || []);
      })
      .catch(() => {});
  }, []);

  // Fetch stats
  useEffect(() => {
    const params = new URLSearchParams();
    if (pipelineId) params.set('pipelineId', pipelineId);
    fetch(`/api/admin/crm/deals/stats?${params}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setStats(json.data);
      })
      .catch(() => {});
  }, [pipelineId]);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      if (pipelineId) params.set('pipelineId', pipelineId);
      if (stageId) params.set('stageId', stageId);

      const res = await fetch(`/api/admin/crm/deals?${params}`);
      const json = await res.json();
      if (json.success) {
        setDeals(json.data || []);
        setTotal(json.pagination?.total || 0);
      }
    } catch {
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [page, search, pipelineId, stageId]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const totalPages = Math.ceil(total / limit);

  const formatCurrency = (value: number | string, currency: string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'CAD' }).format(num || 0);
  };

  const selectedPipeline = pipelines.find(p => p.id === pipelineId);
  const stages = selectedPipeline?.stages?.sort((a, b) => a.position - b.position) || [];

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === deals.length) setSelected(new Set());
    else setSelected(new Set(deals.map(d => d.id)));
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} deals? This cannot be undone.`)) return;
    try {
      const promises = Array.from(selected).map(id =>
        fetch(`/api/admin/crm/deals/${id}`, { method: 'DELETE' })
      );
      await Promise.all(promises);
      toast.success(`${selected.size} deals deleted`);
      setSelected(new Set());
      fetchDeals();
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.deals') || 'Deals'}</h1>
          <p className="text-sm text-gray-500 mt-1">{total} {t('admin.crm.deals') || 'deals'}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            <button
              className="flex items-center gap-1 px-2.5 py-2 text-sm bg-teal-50 text-teal-700 border-r border-gray-300"
              title={t('admin.crm.listView') || 'List View'}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => router.push('/admin/crm/pipeline')}
              className="flex items-center gap-1 px-2.5 py-2 text-sm text-gray-500 hover:bg-gray-50"
              title={t('admin.crm.kanbanView') || 'Kanban View'}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => router.push('/admin/crm/pipeline')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" /> {t('admin.crm.newDeal') || 'New Deal'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              {t('admin.crm.totalValue') || 'Total Value'}
            </div>
            <p className="text-lg font-bold text-gray-900">
              {new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(stats.totalValue)}
            </p>
          </div>
          <div className="bg-white rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {t('admin.crm.weightedValue') || 'Weighted'}
            </div>
            <p className="text-lg font-bold text-teal-700">
              {new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(stats.weightedValue)}
            </p>
          </div>
          <div className="bg-white rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Target className="h-3.5 w-3.5" />
              {t('admin.crm.winRate') || 'Win Rate'}
            </div>
            <p className="text-lg font-bold text-gray-900">
              {Math.round(stats.winRate * 100)}%
            </p>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
              <span className="text-green-600">{stats.wonCount}W</span>
              <span className="text-red-500">{stats.lostCount}L</span>
              <span>{stats.openCount} open</span>
            </div>
          </div>
          <div className="bg-white rounded-lg border px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Clock className="h-3.5 w-3.5" />
              {t('admin.crm.openDeals') || 'Open Deals'}
            </div>
            <p className="text-lg font-bold text-gray-900">{stats.openCount}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{stats.totalDeals} {t('common.total') || 'total'}</p>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('admin.crm.searchDeals') || 'Search deals...'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md"
          />
        </div>
        <select
          value={pipelineId}
          onChange={(e) => { setPipelineId(e.target.value); setStageId(''); setPage(1); }}
          className="text-sm border border-gray-300 rounded-md px-3 py-2"
        >
          <option value="">{t('admin.crm.allPipelines') || 'All Pipelines'}</option>
          {pipelines.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {stages.length > 0 && (
          <select
            value={stageId}
            onChange={(e) => { setStageId(e.target.value); setPage(1); }}
            className="text-sm border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">{t('admin.crm.allStages') || 'All Stages'}</option>
            {stages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-lg">
          <span className="text-sm font-medium text-teal-800">
            {selected.size} {t('common.selected') || 'selected'}
          </span>
          <div className="flex-1" />
          <button
            onClick={bulkDelete}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" /> {t('common.delete') || 'Delete'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="p-1 text-teal-500 hover:bg-teal-100 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" onChange={selectAll} checked={selected.size === deals.length && deals.length > 0} className="rounded" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.dealTitle') || 'Title'}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('admin.crm.dealValue') || 'Value'}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.status') || 'Stage'}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.contact') || 'Contact'}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.assignedTo') || 'Assigned'}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.crm.expectedCloseDate') || 'Expected Close'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500 mx-auto" />
                </td></tr>
              ) : deals.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {t('admin.crm.noDeals') || 'No deals found'}
                </td></tr>
              ) : deals.map((deal) => (
                <tr
                  key={deal.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/admin/crm/deals/${deal.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(deal.id)} onChange={() => toggleSelect(deal.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{deal.title}</div>
                    {deal.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {deal.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="inline-flex px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(deal.value, deal.currency)}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 text-right mt-0.5">
                      {deal.stage.probability}% &rarr; {formatCurrency(
                        (typeof deal.value === 'string' ? parseFloat(deal.value) : deal.value) * deal.stage.probability / 100,
                        deal.currency
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full"
                      style={{
                        backgroundColor: deal.stage.color ? `${deal.stage.color}20` : '#f3f4f6',
                        color: deal.stage.color || '#6b7280',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: deal.stage.color || '#6b7280' }}
                      />
                      {deal.stage.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {deal.contact?.name || deal.contact?.email || deal.lead?.contactName || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {deal.assignedTo?.name || deal.assignedTo?.email || '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString(locale) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">
              {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} / {total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-100"
              >
                {t('common.previous') || 'Prev'}
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-gray-100"
              >
                {t('common.next') || 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
