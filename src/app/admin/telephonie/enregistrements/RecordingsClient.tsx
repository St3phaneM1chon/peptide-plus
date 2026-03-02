'use client';

/**
 * RecordingsClient - List of call recordings with audio player.
 */

import { useI18n } from '@/i18n/client';
import AudioPlayer from '@/components/voip/AudioPlayer';
import { PhoneIncoming, PhoneOutgoing, Phone } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RecordingsClient({ recordings }: { recordings: any[] }) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t('voip.recordings.title')}</h1>

      <div className="space-y-3">
        {recordings.map((rec) => (
          <div key={rec.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {rec.callLog?.direction === 'INBOUND' ? (
                  <PhoneIncoming className="w-4 h-4 text-sky-600" />
                ) : rec.callLog?.direction === 'OUTBOUND' ? (
                  <PhoneOutgoing className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Phone className="w-4 h-4 text-gray-400" />
                )}
                <div>
                  <span className="font-medium text-gray-900">
                    {rec.callLog?.callerName || rec.callLog?.callerNumber}
                  </span>
                  <span className="text-gray-400 mx-2">→</span>
                  <span className="text-gray-600">{rec.callLog?.calledNumber}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {rec.callLog?.startedAt && new Date(rec.callLog.startedAt).toLocaleString('fr-CA', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            </div>

            {rec.callLog?.agent && (
              <div className="text-xs text-gray-500 mb-2">
                {t('voip.recordings.agent')}: {rec.callLog.agent.user?.name || rec.callLog.agent.extension}
                {rec.callLog.client && ` | ${t('voip.recordings.client')}: ${rec.callLog.client.name}`}
              </div>
            )}

            <AudioPlayer
              src={`/api/admin/voip/recordings/${rec.id}`}
              duration={rec.durationSec}
              filename={`recording-${rec.callLogId}.${rec.format}`}
            />

            {rec.transcription?.summary && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg text-sm text-gray-700">
                <span className="text-xs font-medium text-gray-500">{t('voip.recordings.summary')}: </span>
                {rec.transcription.summary}
                {rec.transcription.sentiment && (
                  <span className={`ms-2 text-xs px-1.5 py-0.5 rounded-full ${
                    rec.transcription.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                    rec.transcription.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {rec.transcription.sentiment}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {recordings.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            {t('voip.recordings.empty')}
          </div>
        )}
      </div>
    </div>
  );
}
