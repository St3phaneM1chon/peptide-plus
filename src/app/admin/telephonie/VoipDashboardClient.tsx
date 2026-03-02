'use client';

/**
 * VoIP Dashboard Client Component
 * Renders KPI cards, recent calls table, and connection status.
 */

import { useI18n } from '@/i18n/client';
import CallStats from '@/components/voip/CallStats';
import SatisfactionBadge from '@/components/voip/SatisfactionBadge';
import { formatDuration } from '@/hooks/useCallState';
import {
  Phone, PhoneIncoming, PhoneOutgoing,
  ArrowRight, Voicemail, CheckCircle, XCircle, Wifi,
} from 'lucide-react';
import Link from 'next/link';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function VoipDashboardClient({ data }: { data: any }) {
  const { t } = useI18n();

  const directionIcon = (dir: string) => {
    switch (dir) {
      case 'INBOUND': return <PhoneIncoming className="w-4 h-4 text-sky-600" />;
      case 'OUTBOUND': return <PhoneOutgoing className="w-4 h-4 text-emerald-600" />;
      default: return <Phone className="w-4 h-4 text-gray-400" />;
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-emerald-100 text-emerald-700',
      MISSED: 'bg-red-100 text-red-700',
      VOICEMAIL: 'bg-orange-100 text-orange-700',
      IN_PROGRESS: 'bg-sky-100 text-sky-700',
      FAILED: 'bg-gray-100 text-gray-600',
      TRANSFERRED: 'bg-purple-100 text-purple-700',
      RINGING: 'bg-yellow-100 text-yellow-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
        {t(`voip.status.call.${status.toLowerCase()}`)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('voip.dashboard.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('voip.dashboard.subtitle')}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <CallStats
        today={data.today}
        satisfaction={data.satisfaction}
        activeAgents={data.activeAgents}
        unreadVoicemails={data.unreadVoicemails}
      />

      {/* Connections Status */}
      {data.connections.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('voip.dashboard.connections')}</h3>
          <div className="flex flex-wrap gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {data.connections.map((conn: any) => (
              <div key={conn.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-sm">
                {conn.isEnabled ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-400" />
                )}
                <span className="font-medium capitalize">{conn.provider}</span>
                {conn.syncStatus && (
                  <span className="text-xs text-gray-400">{conn.syncStatus}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Calls */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{t('voip.dashboard.recentCalls')}</h3>
          <Link
            href="/admin/telephonie/journal"
            className="text-sm text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            {t('voip.dashboard.viewAll')} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-2 text-start">{t('voip.callLog.direction')}</th>
                <th className="px-4 py-2 text-start">{t('voip.callLog.caller')}</th>
                <th className="px-4 py-2 text-start">{t('voip.callLog.called')}</th>
                <th className="px-4 py-2 text-start">{t('voip.callLog.agent')}</th>
                <th className="px-4 py-2 text-start">{t('voip.callLog.status')}</th>
                <th className="px-4 py-2 text-start">{t('voip.callLog.duration')}</th>
                <th className="px-4 py-2 text-start">{t('voip.callLog.date')}</th>
                <th className="px-4 py-2 text-start">{t('voip.callLog.satisfaction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {data.recentCalls.map((call: any) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">{directionIcon(call.direction)}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{call.callerName || call.callerNumber}</div>
                    {call.client && (
                      <div className="text-xs text-gray-500">{call.client.name || call.client.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{call.calledNumber}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {call.agent ? `${call.agent.user?.name || ''} (${call.agent.extension})` : '-'}
                  </td>
                  <td className="px-4 py-2.5">{statusBadge(call.status)}</td>
                  <td className="px-4 py-2.5 text-gray-600 tabular-nums">
                    {call.duration ? formatDuration(call.duration) : '-'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {new Date(call.startedAt).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <SatisfactionBadge score={call.survey?.overallScore || null} />
                  </td>
                </tr>
              ))}
              {data.recentCalls.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    {t('voip.dashboard.noCalls')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
