'use client';

/**
 * AnalyticsHubClient - Hub page linking to sub-analytics sections.
 */

import { useI18n } from '@/i18n/client';
import Link from 'next/link';
import { Users, LayoutGrid, Phone, MessageSquare, ArrowRight } from 'lucide-react';

interface SummaryStats {
  totalCalls: number;
  agentCount: number;
  queueCount: number;
  transcriptionCount: number;
  avgSatisfaction: number;
}

interface AnalyticsCard {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  metric: string;
  metricLabel: string;
  color: string;
  bg: string;
}

export default function AnalyticsHubClient({ stats }: { stats: SummaryStats }) {
  const { t } = useI18n();

  const cards: AnalyticsCard[] = [
    {
      title: t('voip.admin.agentPerformance.title'),
      description: t('voip.admin.agentPerformance.subtitle'),
      href: '/admin/telephonie/analytics/agents',
      icon: Users,
      metric: String(stats.agentCount),
      metricLabel: t('voip.admin.wallboard.agentsOnline'),
      color: 'text-teal-600',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
    },
    {
      title: t('voip.admin.queueAnalytics.title'),
      description: t('voip.admin.queueAnalytics.subtitle'),
      href: '/admin/telephonie/analytics/queues',
      icon: LayoutGrid,
      metric: String(stats.queueCount),
      metricLabel: t('voip.admin.queueAnalytics.queue'),
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      title: t('voip.admin.callAnalytics.title'),
      description: t('voip.admin.callAnalytics.subtitle'),
      href: '/admin/telephonie/analytics/appels',
      icon: Phone,
      metric: String(stats.totalCalls),
      metricLabel: t('voip.analytics.totalCalls'),
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      title: t('voip.admin.speechAnalytics.title'),
      description: t('voip.admin.speechAnalytics.subtitle'),
      href: '/admin/telephonie/analytics/speech',
      icon: MessageSquare,
      metric: String(stats.transcriptionCount),
      metricLabel: t('voip.callLog.transcription'),
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('voip.analytics.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('voip.admin.callAnalytics.subtitle')}
        </p>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
          >
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-teal-600 transition-colors">
                {card.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {card.description}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className={`text-2xl font-bold ${card.color}`}>{card.metric}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{card.metricLabel}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
