'use client';

/**
 * CallStats
 * KPI cards for VoIP dashboard: calls today, avg duration, answer rate, satisfaction.
 */

import { Phone, PhoneIncoming, PhoneMissed, Clock, Star, Users, Voicemail } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { formatDuration } from '@/hooks/useCallState';

interface CallStatsProps {
  today: {
    calls: number;
    completed: number;
    missed: number;
    avgDuration: number;
    answerRate: number;
  };
  satisfaction: { avgScore: number | null };
  activeAgents: number;
  unreadVoicemails: number;
}

export default function CallStats({ today, satisfaction, activeAgents, unreadVoicemails }: CallStatsProps) {
  const { t } = useI18n();

  const cards = [
    {
      label: t('voip.dashboard.callsToday'),
      value: today.calls.toString(),
      icon: Phone,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
    {
      label: t('voip.dashboard.answered'),
      value: `${today.answerRate}%`,
      icon: PhoneIncoming,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: t('voip.dashboard.missed'),
      value: today.missed.toString(),
      icon: PhoneMissed,
      color: today.missed > 0 ? 'text-red-600' : 'text-gray-500',
      bg: today.missed > 0 ? 'bg-red-50' : 'bg-gray-50',
    },
    {
      label: t('voip.dashboard.avgDuration'),
      value: formatDuration(today.avgDuration),
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: t('voip.dashboard.satisfaction'),
      value: satisfaction.avgScore ? `${satisfaction.avgScore}/5` : '-',
      icon: Star,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      label: t('voip.dashboard.agentsOnline'),
      value: activeAgents.toString(),
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: t('voip.dashboard.voicemails'),
      value: unreadVoicemails.toString(),
      icon: Voicemail,
      color: unreadVoicemails > 0 ? 'text-orange-600' : 'text-gray-500',
      bg: unreadVoicemails > 0 ? 'bg-orange-50' : 'bg-gray-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${card.bg}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {card.value}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {card.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
