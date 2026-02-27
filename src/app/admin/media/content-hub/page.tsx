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

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  REVIEW: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'In Review' },
  PUBLISHED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Published' },
  ARCHIVED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Archived' },
};

const BAR_COLORS = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
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
        toast.error(t('admin.contentHub.loadError') || 'Failed to load content hub statistics');
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const kpiCards = [
    { label: t('admin.contentHub.totalVideos') || 'Total Videos', value: stats?.totalVideos ?? 0, icon: <Video className="w-5 h-5" />, color: 'text-sky-600' },
    { label: t('admin.contentHub.published') || 'Published', value: stats?.published ?? 0, icon: <FileCheck className="w-5 h-5" />, color: 'text-green-600' },
    { label: t('admin.contentHub.draft') || 'Draft', value: stats?.draft ?? 0, icon: <Clock className="w-5 h-5" />, color: 'text-gray-600' },
    { label: t('admin.contentHub.inReview') || 'In Review', value: stats?.inReview ?? 0, icon: <Eye className="w-5 h-5" />, color: 'text-yellow-600' },
    { label: t('admin.contentHub.archived') || 'Archived', value: stats?.archived ?? 0, icon: <Layout className="w-5 h-5" />, color: 'text-red-600' },
    { label: t('admin.contentHub.totalViews') || 'Total Views', value: formatNumber(stats?.totalViews ?? 0), icon: <TrendingUp className="w-5 h-5" />, color: 'text-violet-600' },
    { label: t('admin.contentHub.activeCategories') || 'Active Categories', value: stats?.activeCategories ?? 0, icon: <FolderOpen className="w-5 h-5" />, color: 'text-amber-600' },
    { label: t('admin.contentHub.activePlacements') || 'Active Placements', value: stats?.activePlacements ?? 0, icon: <ExternalLink className="w-5 h-5" />, color: 'text-teal-600' },
    { label: t('admin.contentHub.pendingConsents') || 'Pending Consents', value: stats?.pendingConsents ?? 0, icon: <FileCheck className="w-5 h-5" />, color: 'text-rose-600' },
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
          <Layout className="w-6 h-6 text-sky-600" />
          <h1 className="text-2xl font-bold text-slate-900">
            {t('admin.contentHub.title') || 'Content Hub'}
          </h1>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-slate-200 p-4">
            <div className={`flex items-center gap-2 ${card.color} mb-1`}>
              {card.icon}
              <span className="text-xs font-medium truncate">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Content Type */}
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            {t('admin.contentHub.byContentType') || 'By Content Type'}
          </h2>
          {byContentType.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              {t('admin.contentHub.noData') || 'No data available'}
            </p>
          ) : (
            <div className="space-y-3">
              {byContentType.map((item, idx) => (
                <div key={item.type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 capitalize">{item.type}</span>
                    <span className="font-medium text-slate-900">{item.count}</span>
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
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            {t('admin.contentHub.bySource') || 'By Source'}
          </h2>
          {bySource.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              {t('admin.contentHub.noData') || 'No data available'}
            </p>
          ) : (
            <div className="space-y-3">
              {bySource.map((item, idx) => (
                <div key={item.source}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 capitalize">{item.source}</span>
                    <span className="font-medium text-slate-900">{item.count}</span>
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
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          {t('admin.contentHub.recentVideos') || 'Recent Videos'}
        </h2>
        {recentVideos.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            {t('admin.contentHub.noVideos') || 'No videos yet'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-4 font-medium text-slate-500">
                    {t('admin.contentHub.videoTitle') || 'Title'}
                  </th>
                  <th className="text-left py-2 pr-4 font-medium text-slate-500">
                    {t('admin.contentHub.status') || 'Status'}
                  </th>
                  <th className="text-left py-2 pr-4 font-medium text-slate-500">
                    {t('admin.contentHub.type') || 'Type'}
                  </th>
                  <th className="text-right py-2 pr-4 font-medium text-slate-500">
                    {t('admin.contentHub.views') || 'Views'}
                  </th>
                  <th className="text-right py-2 font-medium text-slate-500">
                    {t('admin.contentHub.date') || 'Date'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentVideos.map((video) => {
                  const statusBadge = STATUS_BADGES[video.status] || STATUS_BADGES.DRAFT;
                  return (
                    <tr key={video.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-slate-900 truncate block max-w-[280px]">
                          {video.title}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 capitalize">
                          {video.contentType}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-slate-600">
                        {formatNumber(video.views)}
                      </td>
                      <td className="py-2.5 text-right text-slate-500">
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
          <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-slate-900">
                {t('admin.contentHub.createVideo') || 'Create Video'}
              </p>
              <p className="text-xs text-slate-500">
                {t('admin.contentHub.createVideoDesc') || 'Add a new video to the library'}
              </p>
            </div>
          </div>
        </Link>
        <Link href="/admin/media/video-categories">
          <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-slate-900">
                {t('admin.contentHub.manageCategories') || 'Manage Categories'}
              </p>
              <p className="text-xs text-slate-500">
                {t('admin.contentHub.manageCategoriesDesc') || 'Organize video categories'}
              </p>
            </div>
          </div>
        </Link>
        <Link href="/admin/media/consents">
          <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200 hover:border-sky-300 hover:shadow-sm transition-all">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-slate-900">
                {t('admin.contentHub.viewConsents') || 'View Consents'}
              </p>
              <p className="text-xs text-slate-500">
                {t('admin.contentHub.viewConsentsDesc') || 'Review pending consent requests'}
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
