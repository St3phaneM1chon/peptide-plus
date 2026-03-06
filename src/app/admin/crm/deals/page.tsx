'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { Search, Plus, DollarSign } from 'lucide-react';

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

export default function DealsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);

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
  }, [page, search]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const totalPages = Math.ceil(total / limit);

  const formatCurrency = (value: number | string, currency: string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'CAD' }).format(num || 0);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.deals') || 'Deals'}</h1>
          <p className="text-sm text-gray-500 mt-1">{total} {t('admin.crm.deals') || 'deals'}</p>
        </div>
        <button
          onClick={() => router.push('/admin/crm/pipeline')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> {t('admin.crm.newDeal') || 'New Deal'}
        </button>
      </div>

      {/* Search */}
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
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
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto" />
                </td></tr>
              ) : deals.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {t('admin.crm.noDeals') || 'No deals found'}
                </td></tr>
              ) : deals.map((deal) => (
                <tr
                  key={deal.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/admin/crm/deals/${deal.id}`)}
                >
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
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
                      style={{
                        backgroundColor: deal.stage.color ? `${deal.stage.color}20` : '#f3f4f6',
                        color: deal.stage.color || '#6b7280',
                      }}
                    >
                      {deal.stage.name}
                    </span>
                    <span className="ml-1 text-[10px] text-gray-400">{deal.stage.probability}%</span>
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
