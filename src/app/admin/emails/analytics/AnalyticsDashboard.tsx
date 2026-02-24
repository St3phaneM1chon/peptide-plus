'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Mail, Send, XCircle,
  GitBranch, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface AnalyticsData {
  overview: {
    totalSent: number;
    totalBounced: number;
    totalFailed: number;
    deliveryRate: number;
    bounceRate: number;
    totalEmails: number;
    activeCampaigns: number;
    activeFlows: number;
  };
  emailsByDay: Array<{ date: string; count: number; status: string }>;
  topTemplates: Array<{ templateId: string; templateName: string; count: number }>;
  conversationStats: Record<string, number>;
  recentLogs: Array<{ id: string; to: string; subject: string; status: string; sentAt: string }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function AnalyticsDashboard() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  const periodLabels: Record<string, string> = {
    '7d': t('admin.emails.analytics.period7d'),
    '30d': t('admin.emails.analytics.period30d'),
    '90d': t('admin.emails.analytics.period90d'),
    '1y': t('admin.emails.analytics.period1y'),
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/emails/analytics?period=${period}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div className="flex items-center justify-center h-32" role="status" aria-label="Loading"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" /><span className="sr-only">Loading...</span></div>;
  }

  const { overview } = data;

  // Aggregate emails by day for chart
  const dailyData = data.emailsByDay.reduce((acc, item) => {
    const date = typeof item.date === 'string' ? item.date.split('T')[0] : '';
    if (!acc[date]) acc[date] = { date, sent: 0, bounced: 0, failed: 0 };
    if (item.status === 'sent' || item.status === 'delivered') acc[date].sent += item.count;
    else if (item.status === 'bounced') acc[date].bounced += item.count;
    else if (item.status === 'failed') acc[date].failed += item.count;
    return acc;
  }, {} as Record<string, { date: string; sent: number; bounced: number; failed: number }>);

  const chartData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

  // Conversation pie chart
  const convoData = Object.entries(data.conversationStats).map(([status, count]) => ({
    name: status,
    value: count,
  }));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{t('admin.emails.analytics.title')}</h3>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {['7d', '30d', '90d', '1y'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                period === p ? 'bg-white shadow text-slate-900' : 'text-slate-500'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Send className="h-3.5 w-3.5" /> {t('admin.emails.analytics.emailsSent')}
          </div>
          <div className="text-2xl font-bold text-slate-900">{overview.totalSent.toLocaleString(locale)}</div>
          <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
            <ArrowUpRight className="h-3 w-3" /> {t('admin.emails.analytics.deliveryRate')}: {overview.deliveryRate}%
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <XCircle className="h-3.5 w-3.5" /> {t('admin.emails.analytics.bounces')}
          </div>
          <div className="text-2xl font-bold text-red-600">{overview.totalBounced}</div>
          <div className="flex items-center gap-1 text-xs text-red-500 mt-1">
            <ArrowDownRight className="h-3 w-3" /> {t('admin.emails.analytics.bounceRate')}: {overview.bounceRate}%
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <GitBranch className="h-3.5 w-3.5" /> {t('admin.emails.analytics.activeWorkflows')}
          </div>
          <div className="text-2xl font-bold text-slate-900">{overview.activeFlows}</div>
          <div className="text-xs text-slate-400 mt-1">{overview.activeCampaigns} {t('admin.emails.analytics.campaigns')}</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Mail className="h-3.5 w-3.5" /> {t('admin.emails.analytics.conversations')}
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {Object.values(data.conversationStats).reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {data.conversationStats.NEW || 0} {t('admin.emails.analytics.newConversations')}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Send volume chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">{t('admin.emails.analytics.sendVolume')}</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="sent" fill="#3b82f6" name={t('admin.emails.analytics.chartSent')} radius={[2, 2, 0, 0]} />
              <Bar dataKey="bounced" fill="#ef4444" name={t('admin.emails.analytics.chartBounced')} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversation status pie */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">{t('admin.emails.analytics.conversationsByStatus')}</h4>
          {convoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={convoData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                  {convoData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-sm text-slate-400">
              {t('admin.emails.analytics.noConversations')}
            </div>
          )}
        </div>
      </div>

      {/* Top templates */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">{t('admin.emails.analytics.topTemplates')}</h4>
        <div className="space-y-2">
          {data.topTemplates.length > 0 ? data.topTemplates.map((tmpl, i) => (
            <div key={tmpl.templateId || i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700">{tmpl.templateName}</span>
              </div>
              <span className="text-sm font-medium text-slate-900">{tmpl.count}</span>
            </div>
          )) : (
            <p className="text-sm text-slate-400">{t('admin.emails.analytics.noData')}</p>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">{t('admin.emails.analytics.recentActivity')}</h4>
        <div className="space-y-1">
          {data.recentLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full ${
                  log.status === 'sent' || log.status === 'delivered' ? 'bg-green-400' :
                  log.status === 'bounced' ? 'bg-red-400' : 'bg-yellow-400'
                }`} />
                <span className="text-sm text-slate-600 truncate">{log.to}</span>
                <span className="text-xs text-slate-400 truncate hidden sm:block">{log.subject}</span>
              </div>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                {new Date(log.sentAt).toLocaleString(locale)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
