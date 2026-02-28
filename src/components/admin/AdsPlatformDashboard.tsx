'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, DollarSign, MousePointer,
  Eye, Target, RefreshCw, Loader2, ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { fetchWithCSRF } from '@/lib/csrf';
import { toast } from 'sonner';
import { getPlatform } from '@/lib/admin/platform-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdsStats {
  totals: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    ctr: number;
    cpa: number;
  };
  daily: Array<{
    date: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
  }>;
}

interface Campaign {
  campaignId: string | null;
  campaignName: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
}

interface AdsPlatformDashboardProps {
  platform: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdsPlatformDashboard({ platform }: AdsPlatformDashboardProps) {
  const { t } = useI18n();
  const platformInfo = getPlatform(platform);

  const [stats, setStats] = useState<AdsStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [days, setDays] = useState(30);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ads/stats?platform=${platform}&days=${days}`);
      if (!res.ok) throw new Error('Failed to load stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load ads stats:', err);
    }
  }, [platform, days]);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/ads/${platform}/campaigns?days=${days}`);
      if (!res.ok) throw new Error('Failed to load campaigns');
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  }, [platform, days]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadCampaigns()]).finally(() => setLoading(false));
  }, [loadStats, loadCampaigns]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetchWithCSRF('/api/admin/ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();
      const result = data.results?.[0];
      if (result?.success) {
        toast.success(`${t('admin.media.ads.syncSuccess') || 'Sync complete'}: ${result.synced} ${t('admin.media.ads.records') || 'records'}`);
        setLastSync(new Date().toISOString());
        loadStats();
        loadCampaigns();
      } else {
        toast.error(result?.error || t('admin.media.ads.syncFailed') || 'Sync failed');
      }
    } catch {
      toast.error(t('admin.media.ads.syncFailed') || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (v: number) => `$${v.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatNumber = (v: number) => v.toLocaleString('fr-CA');

  // Simple sparkline bar chart
  const maxSpend = stats ? Math.max(...stats.daily.map(d => d.spend), 1) : 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-sky-600" />
            {platformInfo
              ? t(`admin.media.platform${platform.charAt(0).toUpperCase() + platform.slice(1).replace(/-./g, m => m[1].toUpperCase())}`) || platformInfo.nameKey
              : platform}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {t('admin.media.ads.dashboardSubtitle') || 'Campaign performance and analytics'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value={7}>7 {t('admin.media.ads.days') || 'days'}</option>
            <option value={14}>14 {t('admin.media.ads.days') || 'days'}</option>
            <option value={30}>30 {t('admin.media.ads.days') || 'days'}</option>
            <option value={90}>90 {t('admin.media.ads.days') || 'days'}</option>
          </select>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t('admin.media.ads.syncNow') || 'Sync Now'}
          </button>
          {platformInfo && (
            <a
              href={`https://${platform === 'google-ads' ? 'ads.google.com' : platform === 'meta' ? 'business.facebook.com' : platform === 'x' ? 'ads.x.com' : platform === 'linkedin' ? 'www.linkedin.com/campaignmanager' : platform === 'tiktok' ? 'ads.tiktok.com' : 'studio.youtube.com'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {t('admin.media.ads.openPlatform') || 'Open Platform'}
            </a>
          )}
        </div>
      </div>

      {/* Last sync */}
      {lastSync && (
        <p className="text-xs text-slate-400">
          {t('admin.media.ads.lastSync') || 'Last sync'}: {new Date(lastSync).toLocaleString('fr-CA')}
        </p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: t('admin.media.ads.impressions') || 'Impressions', value: formatNumber(stats?.totals.impressions || 0), icon: Eye, color: 'text-blue-600 bg-blue-50' },
          { label: t('admin.media.ads.clicks') || 'Clicks', value: formatNumber(stats?.totals.clicks || 0), icon: MousePointer, color: 'text-green-600 bg-green-50' },
          { label: t('admin.media.ads.ctr') || 'CTR', value: `${stats?.totals.ctr || 0}%`, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
          { label: t('admin.media.ads.spend') || 'Spend', value: formatCurrency(stats?.totals.spend || 0), icon: DollarSign, color: 'text-red-600 bg-red-50' },
          { label: t('admin.media.ads.conversions') || 'Conversions', value: formatNumber(stats?.totals.conversions || 0), icon: Target, color: 'text-purple-600 bg-purple-50' },
          { label: t('admin.media.ads.cpa') || 'CPA', value: formatCurrency(stats?.totals.cpa || 0), icon: DollarSign, color: 'text-sky-600 bg-sky-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg font-bold text-slate-800">{kpi.value}</div>
            <div className="text-xs text-slate-500">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Spend Trend Chart (simple bar chart) */}
      {stats && stats.daily.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {t('admin.media.ads.spendTrend') || 'Spend Trend'} ({days} {t('admin.media.ads.days') || 'days'})
          </h3>
          <div className="flex items-end gap-1 h-32">
            {stats.daily.map((d, i) => {
              const height = Math.max(2, (d.spend / maxSpend) * 100);
              return (
                <div
                  key={i}
                  className="flex-1 bg-sky-500 rounded-t hover:bg-sky-600 transition-colors relative group cursor-default"
                  style={{ height: `${height}%` }}
                  title={`${d.date}: ${formatCurrency(d.spend)}`}
                >
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                    {d.date}: {formatCurrency(d.spend)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No data message */}
      {stats && stats.totals.impressions === 0 && stats.totals.clicks === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">{t('admin.media.ads.noData') || 'No data available'}</p>
            <p className="text-xs text-amber-600 mt-1">
              {t('admin.media.ads.noDataHint') || 'Configure your platform credentials and click "Sync Now" to fetch campaign data.'}
            </p>
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      {campaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">
              {t('admin.media.ads.activeCampaigns') || 'Active Campaigns'} ({campaigns.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">{t('admin.media.ads.campaignName') || 'Campaign'}</th>
                  <th className="px-4 py-3 text-right">{t('admin.media.ads.impressions') || 'Impressions'}</th>
                  <th className="px-4 py-3 text-right">{t('admin.media.ads.clicks') || 'Clicks'}</th>
                  <th className="px-4 py-3 text-right">{t('admin.media.ads.ctr') || 'CTR'}</th>
                  <th className="px-4 py-3 text-right">{t('admin.media.ads.spend') || 'Spend'}</th>
                  <th className="px-4 py-3 text-right">{t('admin.media.ads.conversions') || 'Conv.'}</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={c.campaignId || i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700 font-medium">{c.campaignName || c.campaignId || '-'}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatNumber(c.impressions)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatNumber(c.clicks)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{c.ctr}%</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(c.spend)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatNumber(c.conversions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
