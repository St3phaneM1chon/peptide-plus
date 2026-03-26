'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import {
  Layout, Video, Eye, FolderOpen, FileCheck, Clock,
  TrendingUp, Plus, ExternalLink, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface ContentHubStats {
  totalVideos: number;
  published: number;
  draft: number;
  inReview: number;
  archived: number;
  totalViews: number;
  activeCategories: number;
  activePlacements: number;
  pendingConsents: number;
  byContentType: { type: string; count: number }[];
  bySource: { source: string; count: number }[];
  recentVideos: {
    id: string;
    title: string;
    status: string;
    contentType: string;
    views: number;
    createdAt: string;
  }[];
}

const STATUS_BADGES: Record<string, { bg: string; text: string; key: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', key: 'videoStatus.DRAFT' },
  REVIEW: { bg: 'bg-yellow-100', text: 'text-yellow-700', key: 'videoStatus.REVIEW' },
  PUBLISHED: { bg: 'bg-green-100', text: 'text-green-700', key: 'videoStatus.PUBLISHED' },
  ARCHIVED: { bg: 'bg-red-100', text: 'text-red-700', key: 'videoStatus.ARCHIVED' },
};

const BAR_COLORS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-indigo-500',
  'bg-orange-500',
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ContentHubPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<ContentHubStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetch('/api/admin/content-hub/stats');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error('Failed to load content hub stats:', err);
        toast.error(t('admin.contentHub.loadError'));
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const kpiCards = [
    { label: t('admin.contentHub.totalVideos'), value: stats?.totalVideos ?? 0, icon: <Video className="w-5 h-5" />, color: 'text-indigo-600' },
    { label: t('admin.contentHub.published'), value: stats?.published ?? 0, icon: <FileCheck className="w-5 h-5" />, color: 'text-green-600' },
    { label: t('admin.contentHub.draft'), value: stats?.draft ?? 0, icon: <Clock className="w-5 h-5" />, color: 'text-gray-600' },
    { label: t('admin.contentHub.inReview'), value: stats?.inReview ?? 0, icon: <Eye className="w-5 h-5" />, color: 'text-yellow-600' },
    { label: t('admin.contentHub.archived'), value: stats?.archived ?? 0, icon: <Layout className="w-5 h-5" />, color: 'text-red-600' },
    { label: t('admin.contentHub.totalViews'), value: formatNumber(stats?.totalViews ?? 0), icon: <TrendingUp className="w-5 h-5" />, color: 'text-violet-600' },
    { label: t('admin.contentHub.activeCategories'), value: stats?.activeCategories ?? 0, icon: <FolderOpen className="w-5 h-5" />, color: 'text-amber-600' },
    { label: t('admin.contentHub.activePlacements'), value: stats?.activePlacements ?? 0, icon: <ExternalLink className="w-5 h-5" />, color: 'text-indigo-600' },
    { label: t('admin.contentHub.pendingConsents'), value: stats?.pendingConsents ?? 0, icon: <FileCheck className="w-5 h-5" />, color: 'text-rose-600' },
  ];

  const byContentType = stats?.byContentType ?? [];
  const bySource = stats?.bySource ?? [];
  const recentVideos = stats?.recentVideos ?? [];

  const maxContentTypeCount = Math.max(...byContentType.map(c => c.count), 1);
  const maxSourceCount = Math.max(...bySource.map(s => s.count), 1);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layout className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-[var(--k-text-primary)]">
            {t('admin.contentHub.title')}
          </h1>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] p-4">
            <div className={`flex items-center gap-2 ${card.color} mb-1`}>
              {card.icon}
              <span className="text-xs font-medium truncate">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-[var(--k-text-primary)]">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Content Type */}
        <div className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            {t('admin.contentHub.byContentType')}
          </h2>
          {byContentType.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              {t('admin.contentHub.noData')}
            </p>
          ) : (
            <div className="space-y-3">
              {byContentType.map((item, idx) => (
                <div key={item.type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 capitalize">{item.type}</span>
                    <span className="font-medium text-[var(--k-text-primary)]">{item.count}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]} transition-all duration-500`}
                      style={{ width: `${(item.count / maxContentTypeCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By Source */}
        <div className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            {t('admin.contentHub.bySource')}
          </h2>
          {bySource.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              {t('admin.contentHub.noData')}
            </p>
          ) : (
            <div className="space-y-3">
              {bySource.map((item, idx) => (
                <div key={item.source}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 capitalize">{item.source}</span>
                    <span className="font-medium text-[var(--k-text-primary)]">{item.count}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BAR_COLORS[(idx + 3) % BAR_COLORS.length]} transition-all duration-500`}
                      style={{ width: `${(item.count / maxSourceCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Videos */}
      <div className="bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          {t('admin.contentHub.recentVideos')}
        </h2>
        {recentVideos.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            {t('admin.contentHub.noVideos')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-start py-2 pe-4 font-medium text-slate-500">
                    {t('admin.contentHub.videoTitle')}
                  </th>
                  <th className="text-start py-2 pe-4 font-medium text-slate-500">
                    {t('admin.contentHub.status')}
                  </th>
                  <th className="text-start py-2 pe-4 font-medium text-slate-500">
                    {t('admin.contentHub.type')}
                  </th>
                  <th className="text-end py-2 pe-4 font-medium text-slate-500">
                    {t('admin.contentHub.views')}
                  </th>
                  <th className="text-end py-2 font-medium text-slate-500">
                    {t('admin.contentHub.date')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentVideos.map((video) => {
                  const statusBadge = STATUS_BADGES[video.status] || STATUS_BADGES.DRAFT;
                  return (
                    <tr key={video.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pe-4">
                        <span className="font-medium text-[var(--k-text-primary)] truncate block max-w-[280px]">
                          {video.title}
                        </span>
                      </td>
                      <td className="py-2.5 pe-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                          {t(statusBadge.key)}
                        </span>
                      </td>
                      <td className="py-2.5 pe-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 capitalize">
                          {video.contentType}
                        </span>
                      </td>
                      <td className="py-2.5 pe-4 text-end text-slate-600">
                        {formatNumber(video.views)}
                      </td>
                      <td className="py-2.5 text-end text-slate-500">
                        {formatDate(video.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/admin/media/videos">
          <div className="flex items-center gap-3 p-4 bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] hover:border-indigo-300 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-[var(--k-text-primary)]">
                {t('admin.contentHub.createVideo')}
              </p>
              <p className="text-xs text-slate-500">
                {t('admin.contentHub.createVideoDesc')}
              </p>
            </div>
          </div>
        </Link>
        <Link href="/admin/media/video-categories">
          <div className="flex items-center gap-3 p-4 bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] hover:border-indigo-300 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-[var(--k-text-primary)]">
                {t('admin.contentHub.manageCategories')}
              </p>
              <p className="text-xs text-slate-500">
                {t('admin.contentHub.manageCategoriesDesc')}
              </p>
            </div>
          </div>
        </Link>
        <Link href="/admin/media/consents">
          <div className="flex items-center gap-3 p-4 bg-[var(--k-glass-thin)] rounded-lg border border-[var(--k-border-subtle)] hover:border-indigo-300 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-[var(--k-text-primary)]">
                {t('admin.contentHub.viewConsents')}
              </p>
              <p className="text-xs text-slate-500">
                {t('admin.contentHub.viewConsentsDesc')}
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
