'use client';

/**
 * Media Analytics Page
 * C-08: Real charts with Recharts (no more simple divs).
 */

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import { Eye, MousePointer, Share2, TrendingUp, Loader2, Download } from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

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
    clicks: number;
    shares: number;
    conversions: number;
    engagementRate: number;
  }>;
  dailyTrend: Array<{
    date: string;
    views: number;
    clicks: number;
    shares: number;
    conversions: number;
  }>;
  platformBreakdown: Array<{
    platform: string;
    posts: number;
    published: number;
  }>;
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  twitter: '#1DA1F2',
  tiktok: '#000000',
  linkedin: '#0A66C2',
};

const PIE_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

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
    { label: t('admin.media.totalViews') || 'Total Views', value: analytics.totalViews.toLocaleString(), icon: Eye, color: 'text-blue-600 bg-blue-50', delta: null },
    { label: t('admin.media.totalClicks') || 'Total Clicks', value: analytics.totalClicks.toLocaleString(), icon: MousePointer, color: 'text-green-600 bg-green-50', delta: null },
    { label: t('admin.media.totalShares') || 'Total Shares', value: analytics.totalShares.toLocaleString(), icon: Share2, color: 'text-purple-600 bg-purple-50', delta: null },
    { label: t('admin.media.conversions') || 'Conversions', value: analytics.totalConversions.toLocaleString(), icon: TrendingUp, color: 'text-orange-600 bg-orange-50', delta: null },
  ];

  // Format daily trend for Recharts
  const chartData = analytics.dailyTrend.map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD format for readability
  }));

  // Platform data for pie chart
  const platformPieData = analytics.platformBreakdown.map((p) => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    value: p.posts,
    published: p.published,
  }));

  const engagementPct = (analytics.avgEngagementRate * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('admin.media.analytics') || 'Media Analytics'}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin.media.analyticsDesc') || 'Content performance across all media channels'}
            {' — '}{t('admin.media.engagementRate') || 'Engagement'}: <strong>{engagementPct}%</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        {/* Daily trend — Area Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-5">
          <h3 className="font-semibold mb-4">{t('admin.media.viewsTrend') || 'Daily Interactions'}</h3>
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-400">{t('admin.media.noData') || 'No data for this period'}</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="views" stroke="#3B82F6" fill="#DBEAFE" name={t('admin.media.views') || 'Views'} />
                <Area type="monotone" dataKey="clicks" stroke="#10B981" fill="#D1FAE5" name={t('admin.media.clicks') || 'Clicks'} />
                <Area type="monotone" dataKey="shares" stroke="#8B5CF6" fill="#EDE9FE" name={t('admin.media.shares') || 'Shares'} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Platform breakdown — Pie chart + bar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-5">
          <h3 className="font-semibold mb-4">{t('admin.media.platformBreakdown') || 'Platform Breakdown'}</h3>
          {platformPieData.length === 0 ? (
            <p className="text-sm text-gray-400">{t('admin.media.noData') || 'No data'}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={platformPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {platformPieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name.toLowerCase()] || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {analytics.platformBreakdown.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PLATFORM_COLORS[p.platform] || '#6B7280' }}
                      />
                      {p.platform}
                    </span>
                    <span className="text-gray-500">{p.published}/{p.posts} {t('admin.media.published') || 'published'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Content — Bar chart */}
      {analytics.topContent.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-5">
          <h3 className="font-semibold mb-4">{t('admin.media.topContent') || 'Top Content Performance'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.topContent.slice(0, 10).map((c, i) => ({ ...c, label: `#${i + 1}` }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="views" fill="#3B82F6" name={t('admin.media.views') || 'Views'} />
              <Bar dataKey="clicks" fill="#10B981" name={t('admin.media.clicks') || 'Clicks'} />
              <Bar dataKey="shares" fill="#8B5CF6" name={t('admin.media.shares') || 'Shares'} />
              <Bar dataKey="conversions" fill="#F59E0B" name={t('admin.media.conversions') || 'Conversions'} />
            </BarChart>
          </ResponsiveContainer>
          <div className="divide-y dark:divide-gray-700 mt-4">
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
                  <span className="text-xs text-gray-400 capitalize">{item.contentType}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{item.views.toLocaleString()} views</span>
                  <span>{item.clicks.toLocaleString()} clicks</span>
                  <span className="text-green-600">{(item.engagementRate * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
