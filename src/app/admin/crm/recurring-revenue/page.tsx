'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  RefreshCcw, TrendingUp, TrendingDown, DollarSign,
  BarChart3, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';

interface RecurringRevenueData {
  totalMRR: number;
  totalARR: number;
  newMRR: number;
  churnedMRR: number;
  netNewMRR: number;
  dealCount: number;
  avgDealMRR: number;
  byInterval: { interval: string; count: number; mrr: number }[];
  topDeals: { id: string; title: string; mrrValue: number; recurringInterval: string }[];
}

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(value);
}

export default function RecurringRevenuePage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<RecurringRevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crm/recurring-revenue');
      const json = await res.json();
      if (json.success) setData(json.data);
      else toast.error(json.error?.message || 'Failed to load data');
    } catch { toast.error('Network error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" /></div>
      </div>
    );
  }

  const d = data || { totalMRR: 0, totalARR: 0, newMRR: 0, churnedMRR: 0, netNewMRR: 0, dealCount: 0, avgDealMRR: 0, byInterval: [], topDeals: [] };
  const nrrPercent = d.totalMRR > 0 ? Math.round(((d.totalMRR + d.netNewMRR) / d.totalMRR) * 100) : 100;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <RefreshCcw className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.recurringRevenue') || 'Recurring Revenue'}</h1>
            <p className="text-sm text-gray-500">{t('admin.crm.recurringRevenueDesc') || 'MRR, ARR, churn, and net revenue retention'}</p>
          </div>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:bg-gray-50">
          <RefreshCcw className="h-4 w-4" /> {t('common.refresh') || 'Refresh'}
        </button>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-gray-500 uppercase">MRR</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(d.totalMRR, locale)}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.crm.monthlyRecurring') || 'Monthly Recurring Revenue'}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-teal-600" />
            <span className="text-xs font-medium text-gray-500 uppercase">ARR</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(d.totalARR, locale)}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.crm.annualRecurring') || 'Annual Recurring Revenue'}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-medium text-gray-500 uppercase">{t('admin.crm.newMrr') || 'New MRR'}</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">+{formatCurrency(d.newMRR, locale)}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.crm.thisMonth') || 'This month'}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-gray-500 uppercase">{t('admin.crm.churnedMrr') || 'Churned MRR'}</span>
          </div>
          <p className="text-2xl font-bold text-red-600">-{formatCurrency(d.churnedMRR, locale)}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.crm.thisMonth') || 'This month'}</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{t('admin.crm.netNewMrr') || 'Net New MRR'}</span>
            {d.netNewMRR > 0 ? <ArrowUpRight className="h-4 w-4 text-green-500" /> : d.netNewMRR < 0 ? <ArrowDownRight className="h-4 w-4 text-red-500" /> : <Minus className="h-4 w-4 text-gray-400" />}
          </div>
          <p className={`text-xl font-bold mt-1 ${d.netNewMRR >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {d.netNewMRR >= 0 ? '+' : ''}{formatCurrency(d.netNewMRR, locale)}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <span className="text-sm text-gray-500">{t('admin.crm.nrr') || 'Net Revenue Retention'}</span>
          <p className={`text-xl font-bold mt-1 ${nrrPercent >= 100 ? 'text-green-600' : 'text-red-600'}`}>
            {nrrPercent}%
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <span className="text-sm text-gray-500">{t('admin.crm.recurringDeals') || 'Recurring Deals'}</span>
          <p className="text-xl font-bold text-gray-900 mt-1">{d.dealCount}</p>
          <p className="text-xs text-gray-400">{t('admin.crm.avgMrr') || 'Avg MRR'}: {formatCurrency(d.avgDealMRR, locale)}</p>
        </div>
      </div>

      {/* By Interval */}
      {d.byInterval.length > 0 && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('admin.crm.byInterval') || 'By Interval'}</h3>
          <div className="grid grid-cols-3 gap-3">
            {d.byInterval.map(item => (
              <div key={item.interval} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs font-medium text-gray-500 uppercase">{item.interval}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{item.count} {t('admin.crm.deals') || 'deals'}</p>
                <p className="text-sm text-green-600 font-medium">{formatCurrency(item.mrr, locale)}/mo</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Recurring Deals */}
      {d.topDeals.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-700">{t('admin.crm.topRecurringDeals') || 'Top Recurring Deals'}</h3>
          </div>
          <div className="divide-y">
            {d.topDeals.map((deal, i) => (
              <a key={deal.id} href={`/admin/crm/deals/${deal.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{deal.title}</p>
                  <p className="text-xs text-gray-500">{deal.recurringInterval}</p>
                </div>
                <span className="text-sm font-bold text-green-600">{formatCurrency(deal.mrrValue, locale)}/mo</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
