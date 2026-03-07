'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Handshake,
  DollarSign,
  Target,
  ArrowRight,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  ArrowRightLeft,
  Plus,
  LayoutGrid,
  ListChecks,
  BarChart3,
  Activity,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';

// --- Types ---

interface DashboardData {
  leads: { total: number; newThisWeek: number; hotCount: number; warmCount: number; coldCount: number };
  deals: { total: number; totalValue: number; weightedValue: number; winRate: number; wonCount: number; lostCount: number; openCount: number };
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    createdAt: string;
    performedBy: { name: string | null; email: string };
    lead?: { id: string; contactName: string } | null;
    deal?: { id: string; title: string } | null;
  }>;
  pipelineStages: Array<{ stageId: string; stageName: string; count: number; totalValue: number }>;
}

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  SMS: Mail,
  MEETING: Calendar,
  NOTE: MessageSquare,
  STATUS_CHANGE: ArrowRightLeft,
  DEAL_CREATED: Plus,
};

const ACTIVITY_COLORS: Record<string, string> = {
  CALL: 'text-green-600 bg-green-100',
  EMAIL: 'text-teal-600 bg-teal-100',
  SMS: 'text-purple-600 bg-purple-100',
  MEETING: 'text-indigo-600 bg-indigo-100',
  NOTE: 'text-amber-600 bg-amber-100',
  STATUS_CHANGE: 'text-gray-600 bg-gray-200',
  DEAL_CREATED: 'text-teal-600 bg-teal-100',
  DEAL_WON: 'text-green-600 bg-green-100',
  DEAL_LOST: 'text-red-600 bg-red-100',
};

const NAV_ITEMS = [
  { href: '/admin/crm/leads', icon: Users, labelKey: 'admin.crm.leads', fallback: 'Leads', desc: 'admin.crm.manageLeads' },
  { href: '/admin/crm/deals', icon: Handshake, labelKey: 'admin.crm.deals', fallback: 'Deals', desc: 'admin.crm.manageDeals' },
  { href: '/admin/crm/pipeline', icon: LayoutGrid, labelKey: 'admin.crm.pipeline', fallback: 'Pipeline', desc: 'admin.crm.pipelineDesc' },
  { href: '/admin/crm/lists', icon: ListChecks, labelKey: 'admin.crmLists.title', fallback: 'Prospect Lists', desc: 'admin.crm.prospectsDesc' },
  { href: '/admin/crm/forecast', icon: BarChart3, labelKey: 'admin.crm.forecast', fallback: 'Forecast', desc: 'admin.crm.forecastDesc' },
  { href: '/admin/crm/analytics', icon: Activity, labelKey: 'admin.crm.analytics', fallback: 'Analytics', desc: 'admin.crm.analyticsDesc' },
];

// --- Component ---

export default function CRMDashboardPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [leadsRes, statsRes, activitiesRes] = await Promise.all([
          fetch('/api/admin/crm/leads?limit=1&page=1'),
          fetch('/api/admin/crm/deals/stats'),
          fetch('/api/admin/crm/activities?limit=8'),
        ]);

        const [leadsJson, statsJson, activitiesJson] = await Promise.all([
          leadsRes.json(),
          statsRes.json(),
          activitiesRes.json(),
        ]);

        const totalLeads = leadsJson.pagination?.total || 0;

        // Get lead temperature counts
        const [hotRes, warmRes, coldRes] = await Promise.all([
          fetch('/api/admin/crm/leads?limit=1&temperature=HOT'),
          fetch('/api/admin/crm/leads?limit=1&temperature=WARM'),
          fetch('/api/admin/crm/leads?limit=1&temperature=COLD'),
        ]);
        const [hotJson, warmJson, coldJson] = await Promise.all([
          hotRes.json(), warmRes.json(), coldRes.json(),
        ]);

        // Recent leads (this week)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        setData({
          leads: {
            total: totalLeads,
            newThisWeek: 0, // Would need date filter on API
            hotCount: hotJson.pagination?.total || 0,
            warmCount: warmJson.pagination?.total || 0,
            coldCount: coldJson.pagination?.total || 0,
          },
          deals: {
            total: statsJson.data?.totalDeals || 0,
            totalValue: statsJson.data?.totalValue || 0,
            weightedValue: statsJson.data?.weightedValue || 0,
            winRate: statsJson.data?.winRate || 0,
            wonCount: statsJson.data?.wonCount || 0,
            lostCount: statsJson.data?.lostCount || 0,
            openCount: statsJson.data?.openCount || 0,
          },
          recentActivities: activitiesJson.data || [],
          pipelineStages: statsJson.data?.dealsByStage || [],
        });
      } catch {
        // Silently fail, show empty state
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(amount);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);
    if (diffMin < 1) return t('common.justNow') || 'Just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString(locale);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-lg" />)}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  const d = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.crm.dashboardTitle') || 'CRM Dashboard'}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('admin.crm.dashboardDesc') || 'Manage leads and sales pipeline'}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => router.push('/admin/crm/leads')}
          className="bg-white rounded-lg border px-4 py-4 text-left hover:border-teal-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-teal-600" />
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{d?.leads.total || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('admin.crm.totalLeads') || 'Total Leads'}</p>
          {d && (d.leads.hotCount > 0 || d.leads.warmCount > 0) && (
            <div className="flex items-center gap-2 mt-2 text-[10px]">
              {d.leads.hotCount > 0 && <span className="text-red-500">{d.leads.hotCount} HOT</span>}
              {d.leads.warmCount > 0 && <span className="text-orange-500">{d.leads.warmCount} WARM</span>}
              {d.leads.coldCount > 0 && <span className="text-blue-400">{d.leads.coldCount} COLD</span>}
            </div>
          )}
        </button>

        <button
          onClick={() => router.push('/admin/crm/deals')}
          className="bg-white rounded-lg border px-4 py-4 text-left hover:border-teal-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <Handshake className="h-5 w-5 text-indigo-600" />
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{d?.deals.openCount || 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('admin.crm.openDeals') || 'Open Deals'}</p>
          <p className="text-[10px] text-gray-400 mt-1">{d?.deals.total || 0} {t('common.total') || 'total'}</p>
        </button>

        <button
          onClick={() => router.push('/admin/crm/pipeline')}
          className="bg-white rounded-lg border px-4 py-4 text-left hover:border-teal-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(d?.deals.totalValue || 0)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('admin.crm.totalValue') || 'Pipeline Value'}</p>
          <p className="text-[10px] text-teal-600 mt-1">
            {formatCurrency(d?.deals.weightedValue || 0)} {t('admin.crm.weightedValue') || 'weighted'}
          </p>
        </button>

        <button
          onClick={() => router.push('/admin/crm/forecast')}
          className="bg-white rounded-lg border px-4 py-4 text-left hover:border-teal-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <Target className="h-5 w-5 text-amber-600" />
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{Math.round((d?.deals.winRate || 0) * 100)}%</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('admin.crm.winRate') || 'Win Rate'}</p>
          <div className="flex items-center gap-2 mt-1 text-[10px]">
            <span className="text-green-600">{d?.deals.wonCount || 0}W</span>
            <span className="text-red-500">{d?.deals.lostCount || 0}L</span>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Funnel */}
        <div className="lg:col-span-2 bg-white rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-700">{t('admin.crm.pipelineStages') || 'Pipeline'}</h3>
            <button
              onClick={() => router.push('/admin/crm/pipeline')}
              className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              {t('admin.crm.viewKanban') || 'View Kanban'} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-4">
            {d?.pipelineStages && d.pipelineStages.length > 0 ? (
              <div className="space-y-2">
                {d.pipelineStages.map((stage, idx) => {
                  const maxCount = Math.max(...d.pipelineStages.map(s => s.count), 1);
                  const pct = (stage.count / maxCount) * 100;
                  return (
                    <div key={stage.stageId} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-24 truncate text-right">{stage.stageName}</span>
                      <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden relative">
                        <div
                          className="h-full rounded-md transition-all"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            backgroundColor: `hsl(${170 - idx * 20}, 60%, ${45 + idx * 5}%)`,
                          }}
                        />
                        {stage.count > 0 && (
                          <div className="absolute inset-0 flex items-center px-2">
                            <span className="text-[11px] font-medium text-white drop-shadow-sm">
                              {stage.count} &middot; {formatCurrency(stage.totalValue)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">{t('admin.crm.noPipelineData') || 'No pipeline data'}</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-700">{t('admin.crm.recentActivity') || 'Recent Activity'}</h3>
          </div>
          <div className="p-3">
            {d?.recentActivities && d.recentActivities.length > 0 ? (
              <div className="space-y-0">
                {d.recentActivities.map((activity, idx) => {
                  const Icon = ACTIVITY_ICONS[activity.type] || MessageSquare;
                  const colors = ACTIVITY_COLORS[activity.type] || 'text-gray-500 bg-gray-100';
                  const isLast = idx === d.recentActivities.length - 1;
                  return (
                    <div key={activity.id} className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className={`p-1 rounded-full ${colors.split(' ')[1]}`}>
                          <Icon className={`h-3 w-3 ${colors.split(' ')[0]}`} />
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-gray-200 my-0.5" />}
                      </div>
                      <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-2.5'}`}>
                        <p className="text-xs text-gray-900 leading-snug truncate">{activity.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {activity.lead && (
                            <button
                              onClick={() => router.push(`/admin/crm/leads/${activity.lead!.id}`)}
                              className="text-[10px] text-teal-600 hover:underline truncate max-w-[100px]"
                            >
                              {activity.lead.contactName}
                            </button>
                          )}
                          {activity.deal && (
                            <button
                              onClick={() => router.push(`/admin/crm/deals/${activity.deal!.id}`)}
                              className="text-[10px] text-indigo-600 hover:underline truncate max-w-[100px]"
                            >
                              {activity.deal.title}
                            </button>
                          )}
                          <span className="text-[10px] text-gray-400">{formatTime(activity.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">{t('admin.crm.noActivities') || 'No activities yet'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('admin.crm.quickNav') || 'Quick Access'}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {NAV_ITEMS.map(({ href, icon: Icon, labelKey, fallback, desc }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="bg-white rounded-lg border px-4 py-3 text-left hover:border-teal-300 hover:shadow-sm transition-all group"
            >
              <Icon className="h-5 w-5 text-gray-400 group-hover:text-teal-600 transition-colors mb-2" />
              <p className="text-sm font-medium text-gray-900">{t(labelKey) || fallback}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{t(desc) || ''}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
