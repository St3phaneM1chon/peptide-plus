'use client';

/**
 * CallLogClient - Interactive call log table with filters.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { useI18n } from '@/i18n/client';
import { formatDuration } from '@/hooks/useCallState';
import SatisfactionBadge from '@/components/voip/SatisfactionBadge';
import AudioPlayer from '@/components/voip/AudioPlayer';
import {
  Phone, PhoneIncoming, PhoneOutgoing, Search,
  Filter, ChevronLeft, ChevronRight, FileText,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CallLogClient() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', '25');
  if (search) params.set('search', search);
  if (direction) params.set('direction', direction);
  if (status) params.set('status', status);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  const { data, isLoading } = useSWR(`/api/admin/voip/call-logs?${params}`, fetcher, {
    refreshInterval: 15000,
  });

  const directionIcon = (dir: string) => {
    switch (dir) {
      case 'INBOUND': return <PhoneIncoming className="w-4 h-4 text-sky-600" />;
      case 'OUTBOUND': return <PhoneOutgoing className="w-4 h-4 text-emerald-600" />;
      default: return <Phone className="w-4 h-4 text-gray-400" />;
    }
  };

  const statusColors: Record<string, string> = {
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    MISSED: 'bg-red-100 text-red-700',
    VOICEMAIL: 'bg-orange-100 text-orange-700',
    IN_PROGRESS: 'bg-sky-100 text-sky-700',
    FAILED: 'bg-gray-100 text-gray-600',
    TRANSFERRED: 'bg-purple-100 text-purple-700',
    RINGING: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t('voip.callLog.title')}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('voip.callLog.searchPlaceholder')}
              className="w-full ps-9 pe-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <select
          value={direction}
          onChange={(e) => { setDirection(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">{t('voip.callLog.allDirections')}</option>
          <option value="INBOUND">{t('voip.callLog.inbound')}</option>
          <option value="OUTBOUND">{t('voip.callLog.outbound')}</option>
          <option value="INTERNAL">{t('voip.callLog.internal')}</option>
        </select>

        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">{t('voip.callLog.allStatuses')}</option>
          <option value="COMPLETED">{t('voip.status.call.completed')}</option>
          <option value="MISSED">{t('voip.status.call.missed')}</option>
          <option value="VOICEMAIL">{t('voip.status.call.voicemail')}</option>
          <option value="FAILED">{t('voip.status.call.failed')}</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">{t('common.loading')}...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-2 text-start" />
                    <th className="px-4 py-2 text-start">{t('voip.callLog.caller')}</th>
                    <th className="px-4 py-2 text-start">{t('voip.callLog.called')}</th>
                    <th className="px-4 py-2 text-start">{t('voip.callLog.agent')}</th>
                    <th className="px-4 py-2 text-start">{t('voip.callLog.status')}</th>
                    <th className="px-4 py-2 text-start">{t('voip.callLog.duration')}</th>
                    <th className="px-4 py-2 text-start">{t('voip.callLog.date')}</th>
                    <th className="px-4 py-2 text-start">{t('voip.callLog.satisfaction')}</th>
                    <th className="px-4 py-2 text-start" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {data?.callLogs?.map((call: any) => (
                    <>
                      <tr
                        key={call.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                      >
                        <td className="px-4 py-2.5">{directionIcon(call.direction)}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900">{call.callerName || call.callerNumber}</div>
                          {call.client && <div className="text-xs text-gray-500">{call.client.name}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{call.calledNumber}</td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {call.agent ? `${call.agent.user?.name || ''} (${call.agent.extension})` : '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[call.status] || 'bg-gray-100'}`}>
                            {call.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 tabular-nums">
                          {call.duration ? formatDuration(call.duration) : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {new Date(call.startedAt).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-2.5">
                          <SatisfactionBadge score={call.survey?.overallScore || null} />
                        </td>
                        <td className="px-4 py-2.5">
                          {call.recording && <FileText className="w-4 h-4 text-gray-400" />}
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {expandedId === call.id && (
                        <tr key={`${call.id}-detail`}>
                          <td colSpan={9} className="bg-gray-50 px-4 py-3">
                            <div className="flex flex-wrap gap-4 text-sm">
                              {call.recording?.id && (
                                <div className="flex-1 min-w-[250px]">
                                  <span className="text-xs font-medium text-gray-500 block mb-1">
                                    {t('voip.callLog.recording')}
                                  </span>
                                  <AudioPlayer
                                    src={`/api/admin/voip/recordings/${call.recording.id}`}
                                    duration={call.recording.durationSec}
                                  />
                                </div>
                              )}
                              {call.transcription && (
                                <div className="flex-1 min-w-[200px]">
                                  <span className="text-xs font-medium text-gray-500 block mb-1">
                                    {t('voip.callLog.transcription')}
                                  </span>
                                  <p className="text-gray-700">{call.transcription.summary || '-'}</p>
                                  {call.transcription.sentiment && (
                                    <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${
                                      call.transcription.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                                      call.transcription.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {call.transcription.sentiment}
                                    </span>
                                  )}
                                </div>
                              )}
                              {call.agentNotes && (
                                <div className="flex-1 min-w-[200px]">
                                  <span className="text-xs font-medium text-gray-500 block mb-1">Notes</span>
                                  <p className="text-gray-700">{call.agentNotes}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data?.pagination && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
                <span>
                  {t('voip.callLog.showing')} {((page - 1) * 25) + 1}-{Math.min(page * 25, data.pagination.total)} / {data.pagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>{page} / {data.pagination.totalPages}</span>
                  <button
                    onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                    disabled={page >= data.pagination.totalPages}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
