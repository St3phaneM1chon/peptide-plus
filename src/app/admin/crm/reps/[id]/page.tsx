'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  LayoutDashboard, Phone, Briefcase, Calendar, DollarSign,
  Target, Award, BarChart3, StickyNote, ArrowLeft, Mail, MessageSquare, Video,
  Loader2, ChevronDown,
} from 'lucide-react';

import RepProfileHeader from '@/components/admin/crm/rep-dashboard/RepProfileHeader';
import RepKpiCards from '@/components/admin/crm/rep-dashboard/RepKpiCards';
import RepCommunicationsHub from '@/components/admin/crm/rep-dashboard/RepCommunicationsHub';
import RepDealTable from '@/components/admin/crm/rep-dashboard/RepDealTable';
import RepFollowUpCalendar from '@/components/admin/crm/rep-dashboard/RepFollowUpCalendar';
import RepRevenueChart from '@/components/admin/crm/rep-dashboard/RepRevenueChart';
import RepQuotaProgress from '@/components/admin/crm/rep-dashboard/RepQuotaProgress';
import RepBonusTracker from '@/components/admin/crm/rep-dashboard/RepBonusTracker';
import RepStatsSummary from '@/components/admin/crm/rep-dashboard/RepStatsSummary';
import RepNotesActivity from '@/components/admin/crm/rep-dashboard/RepNotesActivity';

interface RepInfo {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  createdAt: string;
}

type TabKey = 'overview' | 'communications' | 'deals' | 'followups' | 'revenue' | 'quotas' | 'commissions' | 'statistics';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}

export default function RepDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [period, setPeriod] = useState('month');
  const [rep, setRep] = useState<RepInfo | null>(null);
  const [loadingRep, setLoadingRep] = useState(true);

  const tabs: TabConfig[] = [
    { key: 'overview', label: t('admin.crm.repTabs.overview'), icon: LayoutDashboard },
    { key: 'communications', label: t('admin.crm.repTabs.communications'), icon: Phone },
    { key: 'deals', label: t('admin.crm.repTabs.deals'), icon: Briefcase },
    { key: 'followups', label: t('admin.crm.repTabs.followups'), icon: Calendar },
    { key: 'revenue', label: t('admin.crm.repTabs.revenue'), icon: DollarSign },
    { key: 'quotas', label: t('admin.crm.repTabs.quotas'), icon: Target },
    { key: 'commissions', label: t('admin.crm.repTabs.commissions'), icon: Award },
    { key: 'statistics', label: t('admin.crm.repTabs.statistics'), icon: BarChart3 },
  ];

  const periods = [
    { value: 'week', label: t('admin.crm.periods.week') },
    { value: 'month', label: t('admin.crm.periods.month') },
    { value: 'quarter', label: t('admin.crm.periods.quarter') },
    { value: 'year', label: t('admin.crm.periods.year') },
    { value: 'all', label: t('admin.crm.periods.all') },
  ];

  const fetchRepInfo = useCallback(async () => {
    setLoadingRep(true);
    try {
      const res = await fetch(`/api/admin/crm/reps/${id}/dashboard?section=overview&period=${period}`);
      const json = await res.json();
      if (json.success && json.data?.rep) {
        setRep(json.data.rep);
      } else {
        toast.error(json.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoadingRep(false);
    }
  }, [id, period, t]);

  useEffect(() => {
    fetchRepInfo();
  }, [fetchRepInfo]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <RepKpiCards agentId={id} period={period} />
            <RepNotesActivity agentId={id} period={period} />
          </div>
        );
      case 'communications':
        return <RepCommunicationsHub agentId={id} period={period} />;
      case 'deals':
        return <RepDealTable agentId={id} period={period} />;
      case 'followups':
        return <RepFollowUpCalendar agentId={id} period={period} />;
      case 'revenue':
        return <RepRevenueChart agentId={id} period={period} />;
      case 'quotas':
        return <RepQuotaProgress agentId={id} period={period} />;
      case 'commissions':
        return <RepBonusTracker agentId={id} period={period} />;
      case 'statistics':
        return <RepStatsSummary agentId={id} period={period} />;
      default:
        return null;
    }
  };

  if (loadingRep && !rep) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Back Button & Period Selector */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/admin/crm/reps')}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('admin.crm.backToReps')}
        </button>

        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
          >
            {periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Profile Header */}
      {rep && <RepProfileHeader agentId={id} period={period} />}

      {/* Tabs Navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-0 min-w-max" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {renderTabContent()}
      </div>
    </div>
  );
}
