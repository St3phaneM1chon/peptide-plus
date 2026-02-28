'use client';

/**
 * Media Analytics Page
 * Chantier 4.2: Dashboard with content performance metrics.
 */

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import { BarChart3, Eye, MousePointer, Share2, TrendingUp, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface AnalyticsSummary {
  totalViews: number;
  totalClicks: number;
  totalShares: number;
  totalConversions: number;
  avgEngagementRate: number;
  topContent: Array<{
    contentId: string;
    contentType: string;
    views: number;
  }>;
  dailyTrend: Array<{
    date: string;
    views: number;
  }>;
  platformBreakdown: Array<{
    platform: string;
    posts: number;
    published: number;
  }>;
}

export default function MediaAnalyticsPage() {
  const { t } = useI18n();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/media/analytics?days=${days}`)
      .then((r) => r.json())
      .then((data) => setAnalytics(data.analytics))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6 text-center text-gray-500">
        {t('admin.media.analyticsError') || 'Failed to load analytics'}
      </div>
    );
  }

  const stats = [
    { label: t('admin.media.totalViews') || 'Total Views', value: analytics.totalViews.toLocaleString(), icon: Eye, color: 'text-blue-600 bg-blue-50' },
    { label: t('admin.media.totalClicks') || 'Total Clicks', value: analytics.totalClicks.toLocaleString(), icon: MousePointer, color: 'text-green-600 bg-green-50' },
    { label: t('admin.media.totalShares') || 'Total Shares', value: analytics.totalShares.toLocaleString(), icon: Share2, color: 'text-purple-600 bg-purple-50' },
    { label: t('admin.media.conversions') || 'Conversions', value: analytics.totalConversions.toLocaleString(), icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.media.analytics') || 'Media Analytics'}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.media.analyticsDesc') || 'Content performance across all media channels'}
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value={7}>7 {t('common.days') || 'days'}</option>
          <option value={30}>30 {t('common.days') || 'days'}</option>
          <option value={90}>90 {t('common.days') || 'days'}</option>
          <option value={365}>365 {t('common.days') || 'days'}</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily trend (simple bar representation) */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            {t('admin.media.viewsTrend') || 'Views Trend'}
          </h3>
          {analytics.dailyTrend.length === 0 ? (
            <p className="text-sm text-gray-400">{t('admin.media.noData') || 'No data for this period'}</p>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {analytics.dailyTrend.slice(-30).map((d) => {
                const maxViews = Math.max(...analytics.dailyTrend.map((dd) => dd.views), 1);
                const height = Math.max(4, (d.views / maxViews) * 100);
                return (
                  <div
                    key={d.date}
                    className="flex-1 bg-blue-400 rounded-t hover:bg-blue-500 transition-colors"
                    style={{ height: `${height}%` }}
                    title={`${d.date}: ${d.views} views`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Platform breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-5">
          <h3 className="font-semibold mb-4">
            {t('admin.media.platformBreakdown') || 'Platform Breakdown'}
          </h3>
          {analytics.platformBreakdown.length === 0 ? (
            <p className="text-sm text-gray-400">{t('admin.media.noData') || 'No data'}</p>
          ) : (
            <div className="space-y-3">
              {analytics.platformBreakdown.map((p) => (
                <div key={p.platform} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{p.platform}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500">{p.posts} posts</span>
                    <span className="text-green-600">{p.published} published</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Content */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-5">
        <h3 className="font-semibold mb-4">{t('admin.media.topContent') || 'Top Content'}</h3>
        <div className="divide-y dark:divide-gray-700">
          {analytics.topContent.slice(0, 10).map((item, idx) => (
            <div key={item.contentId} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 w-6">{idx + 1}</span>
                <Link
                  href={`/admin/media/videos/${item.contentId}`}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {item.contentId.slice(0, 8)}...
                </Link>
              </div>
              <span className="text-sm text-gray-500">{item.views.toLocaleString()} views</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
