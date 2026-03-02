'use client';

/**
 * VoicemailClient - List voicemails with read/archive actions.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { Voicemail, Mail, MailOpen, Archive, User, Clock } from 'lucide-react';
import AudioPlayer from '@/components/voip/AudioPlayer';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function VoicemailClient({ voicemails: initial }: { voicemails: any[] }) {
  const { t } = useI18n();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [voicemails, setVoicemails] = useState<any[]>(initial);

  const handleAction = async (ids: string[], action: 'markRead' | 'archive') => {
    try {
      await fetch('/api/admin/voip/voicemails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });

      if (action === 'archive') {
        setVoicemails((prev) => prev.filter((vm) => !ids.includes(vm.id)));
      } else {
        setVoicemails((prev) => prev.map((vm) =>
          ids.includes(vm.id) ? { ...vm, isRead: true } : vm
        ));
      }
      toast.success(t('voip.voicemail.updated'));
    } catch {
      toast.error(t('voip.voicemail.updateFailed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('voip.voicemail.title')}</h1>
        <span className="text-sm text-gray-500">
          {voicemails.filter((vm) => !vm.isRead).length} {t('voip.voicemail.unread')}
        </span>
      </div>

      <div className="space-y-2">
        {voicemails.map((vm) => (
          <div
            key={vm.id}
            className={`bg-white border rounded-xl p-4 ${
              vm.isRead ? 'border-gray-200' : 'border-sky-200 bg-sky-50/30'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                {vm.isRead ? (
                  <MailOpen className="w-5 h-5 text-gray-400" />
                ) : (
                  <Mail className="w-5 h-5 text-sky-600" />
                )}
                <div>
                  <div className="font-medium text-gray-900">
                    {vm.callerName || vm.callerNumber}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span>{vm.callerNumber}</span>
                    <span>→</span>
                    <span>{vm.extension?.user?.name || vm.extension?.extension}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(vm.createdAt).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                {!vm.isRead && (
                  <button
                    onClick={() => handleAction([vm.id], 'markRead')}
                    className="text-xs text-sky-600 hover:text-sky-700"
                  >
                    {t('voip.voicemail.markRead')}
                  </button>
                )}
                <button
                  onClick={() => handleAction([vm.id], 'archive')}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title={t('voip.voicemail.archive')}
                >
                  <Archive className="w-4 h-4" />
                </button>
              </div>
            </div>

            {vm.blobUrl && (
              <AudioPlayer
                src={vm.blobUrl}
                duration={vm.durationSec}
                compact
              />
            )}

            {vm.transcription && (
              <p className="mt-2 text-sm text-gray-600 italic">&ldquo;{vm.transcription}&rdquo;</p>
            )}

            {vm.client && (
              <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                <User className="w-3 h-3" /> {vm.client.name || vm.client.email}
              </div>
            )}
          </div>
        ))}

        {voicemails.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            <Voicemail className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            {t('voip.voicemail.empty')}
          </div>
        )}
      </div>
    </div>
  );
}
