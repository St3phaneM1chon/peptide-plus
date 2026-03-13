'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Phone,
  DollarSign,
  Trophy,
  XCircle,
  Users,
  TrendingUp,
  Bell,
  Coins,
  Loader2,
  BarChart3,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface KpiData {
  callsTotal?: number;
  revenue?: number;
  dealsWon?: number;
  dealsLost?: number;
  activeLeads?: number;
  pipelineValue?: number;
  followUpsDue?: number;
  commissionEarned?: number;
}

interface RepKpiCardsProps {
  agentId: string;
  period: string;
}

// ── KPI card config ─────────────────────────────────────────────

interface KpiCardConfig {
  key: keyof KpiData;
  labelKey: string;
  fallbackLabel: string;
  icon: typeof Phone;
  iconBg: string;
  iconColor: string;
  isCurrency: boolean;
}

const KPI_CARDS: KpiCardConfig[] = [
  { key: 'callsTotal', labelKey: 'admin.crm.kpi.callsTotal', fallbackLabel: 'Calls Total', icon: Phone, iconBg: 'bg-blue-100 dark:bg-blue-900', iconColor: 'text-blue-600 dark:text-blue-300', isCurrency: false },
  { key: 'revenue', labelKey: 'admin.crm.kpi.revenue', fallbackLabel: 'Revenue', icon: DollarSign, iconBg: 'bg-green-100 dark:bg-green-900', iconColor: 'text-green-600 dark:text-green-300', isCurrency: true },
  { key: 'dealsWon', labelKey: 'admin.crm.kpi.dealsWon', fallbackLabel: 'Deals Won', icon: Trophy, iconBg: 'bg-emerald-100 dark:bg-emerald-900', iconColor: 'text-emerald-600 dark:text-emerald-300', isCurrency: false },
  { key: 'dealsLost', labelKey: 'admin.crm.kpi.dealsLost', fallbackLabel: 'Deals Lost', icon: XCircle, iconBg: 'bg-red-100 dark:bg-red-900', iconColor: 'text-red-600 dark:text-red-300', isCurrency: false },
  { key: 'activeLeads', labelKey: 'admin.crm.kpi.activeLeads', fallbackLabel: 'Active Leads', icon: Users, iconBg: 'bg-purple-100 dark:bg-purple-900', iconColor: 'text-purple-600 dark:text-purple-300', isCurrency: false },
  { key: 'pipelineValue', labelKey: 'admin.crm.kpi.pipelineValue', fallbackLabel: 'Pipeline Value', icon: TrendingUp, iconBg: 'bg-indigo-100 dark:bg-indigo-900', iconColor: 'text-indigo-600 dark:text-indigo-300', isCurrency: true },
  { key: 'followUpsDue', labelKey: 'admin.crm.kpi.followUpsDue', fallbackLabel: 'Follow-ups Due', icon: Bell, iconBg: 'bg-yellow-100 dark:bg-yellow-900', iconColor: 'text-yellow-600 dark:text-yellow-300', isCurrency: false },
  { key: 'commissionEarned', labelKey: 'admin.crm.kpi.commissionEarned', fallbackLabel: 'Commission Earned', icon: Coins, iconBg: 'bg-amber-100 dark:bg-amber-900', iconColor: 'text-amber-600 dark:text-amber-300', isCurrency: true },
];

// ── Skeleton card ───────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────

export default function RepKpiCards({ agentId, period }: RepKpiCardsProps) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchKpis() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/crm/reps/${agentId}/dashboard?section=overview&period=${period}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load KPIs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchKpis();
    return () => { cancelled = true; };
  }, [agentId, period]);

  const formatValue = (value: number | undefined, isCurrency: boolean): string => {
    if (value === undefined || value === null) return '-';
    if (isCurrency) {
      return new Intl.NumberFormat(locale || 'en', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return new Intl.NumberFormat(locale || 'en').format(value);
  };

  // Loading skeletons
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex items-center text-red-500">
        <BarChart3 className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {KPI_CARDS.map((card) => {
        const Icon = card.icon;
        const value = data?.[card.key];

        return (
          <div
            key={card.key}
            className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${card.iconBg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {t(card.labelKey) || card.fallbackLabel}
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatValue(value, card.isCurrency)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
