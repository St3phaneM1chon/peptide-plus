'use client';

/**
 * VoicemailClient - Visual voicemail with waveform player, AI transcription,
 * CRM contact linking, and callback button.
 */

import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Voicemail,
  Mail,
  MailOpen,
  Archive,
  User,
  Clock,
  Phone,
  PhoneOutgoing,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import AudioPlayer from '@/components/voip/AudioPlayer';
import { toast } from 'sonner';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface VoicemailItem {
  id: string;
  callerName: string | null;
  callerNumber: string;
  durationSec: number;
  blobUrl: string | null;
  transcription: string | null;
  isRead: boolean;
  createdAt: string;
  extension?: {
    extension: string;
    user?: { name: string | null };
  } | null;
  client?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  // AI analysis fields (from Whisper transcription)
  aiSummary?: string | null;
  sentiment?: 'positive' | 'neutral' | 'negative' | null;
  keywords?: string[] | null;
  urgency?: 'high' | 'normal' | 'low' | null;
}

export default function VoicemailClient({ voicemails: initial }: { voicemails: VoicemailItem[] }) {
  const { t } = useI18n();
  const [voicemails, setVoicemails] = useState<VoicemailItem[]>(initial);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const handleAction = async (ids: string[], action: 'markRead' | 'archive' | 'delete') => {
    try {
      await fetch('/api/admin/voip/voicemails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });

      if (action === 'archive' || action === 'delete') {
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

  const handleCallback = useCallback((phone: string) => {
    // Dispatch to softphone
    window.dispatchEvent(new CustomEvent('softphone:dial', {
      detail: { number: phone },
    }));
    toast.success(t('voip.voicemail.callingBack'));
  }, [t]);

  const formatDuration = (sec: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const filteredVoicemails = voicemails.filter((vm) => {
    if (filter === 'unread') return !vm.isRead;
    if (filter === 'read') return vm.isRead;
    return true;
  });

  const unreadCount = voicemails.filter((vm) => !vm.isRead).length;

  const sentimentColor = (s: string | null | undefined) => {
    if (s === 'positive') return 'text-emerald-600 bg-emerald-50';
    if (s === 'negative') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{t('voip.voicemail.title')}</h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
              {unreadCount} {t('voip.voicemail.unread')}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['all', 'unread', 'read'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? t('voip.voicemail.filterAll') || 'All'
                : f === 'unread' ? t('voip.voicemail.filterUnread') || 'Unread'
                : t('voip.voicemail.filterRead') || 'Read'}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {unreadCount > 0 && filter !== 'read' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const unreadIds = voicemails.filter((vm) => !vm.isRead).map((vm) => vm.id);
              handleAction(unreadIds, 'markRead');
            }}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
          >
            {t('voip.voicemail.markAllRead') || 'Mark all as read'}
          </button>
        </div>
      )}

      {/* Voicemail list */}
      <div className="space-y-2">
        {filteredVoicemails.map((vm) => {
          const isExpanded = expandedId === vm.id;

          return (
            <div
              key={vm.id}
              className={`bg-white border rounded-xl overflow-hidden transition-shadow ${
                vm.isRead ? 'border-gray-200' : 'border-teal-200 bg-teal-50/30 shadow-sm'
              }`}
            >
              {/* Main row */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {vm.isRead ? (
                      <MailOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <Mail className="w-5 h-5 text-teal-600 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {vm.callerName || vm.callerNumber}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        <span>{vm.callerNumber}</span>
                        <span>→</span>
                        <span>{vm.extension?.user?.name || vm.extension?.extension}</span>
                        <span className="text-gray-400">•</span>
                        <span>{formatDuration(vm.durationSec)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Urgency indicator */}
                    {vm.urgency === 'high' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase">
                        {t('voip.voicemail.urgent') || 'Urgent'}
                      </span>
                    )}

                    {/* Sentiment badge */}
                    {vm.sentiment && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sentimentColor(vm.sentiment)}`}>
                        {vm.sentiment === 'positive' ? '😊' : vm.sentiment === 'negative' ? '😟' : '😐'}
                      </span>
                    )}

                    {/* Timestamp */}
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(vm.createdAt).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>

                    {/* Actions */}
                    {!vm.isRead && (
                      <button
                        onClick={() => handleAction([vm.id], 'markRead')}
                        className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                      >
                        {t('voip.voicemail.markRead')}
                      </button>
                    )}

                    {/* Callback */}
                    <button
                      onClick={() => handleCallback(vm.callerNumber)}
                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                      title={t('voip.voicemail.callback') || 'Call back'}
                    >
                      <PhoneOutgoing className="w-4 h-4" />
                    </button>

                    {/* Archive */}
                    <button
                      onClick={() => handleAction([vm.id], 'archive')}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title={t('voip.voicemail.archive')}
                    >
                      <Archive className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleAction([vm.id], 'delete')}
                      className="p-1 text-gray-400 hover:text-red-500"
                      title={t('voip.voicemail.delete') || 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Expand/collapse */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : vm.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Audio player */}
                {vm.blobUrl && (
                  <AudioPlayer
                    src={vm.blobUrl}
                    duration={vm.durationSec}
                  />
                )}

                {/* Quick transcription preview */}
                {vm.transcription && !isExpanded && (
                  <p className="mt-2 text-sm text-gray-600 italic line-clamp-2">
                    &ldquo;{vm.transcription}&rdquo;
                  </p>
                )}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-3">
                  {/* Full transcription */}
                  {vm.transcription && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <FileText className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-medium text-gray-700">
                          {t('voip.voicemail.transcriptionLabel') || 'Transcription'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-200">
                        {vm.transcription}
                      </p>
                    </div>
                  )}

                  {/* AI Summary */}
                  {vm.aiSummary && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-xs font-medium text-gray-700">
                          {t('voip.voicemail.aiSummary') || 'AI Summary'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 bg-purple-50 rounded-lg p-3 border border-purple-100">
                        {vm.aiSummary}
                      </p>
                    </div>
                  )}

                  {/* Keywords */}
                  {vm.keywords && vm.keywords.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">{t('voip.voicemail.keywords') || 'Keywords'}:</span>
                      {vm.keywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* CRM Contact */}
                  {vm.client && (
                    <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                      <User className="w-4 h-4 text-emerald-600" />
                      <div>
                        <span className="text-sm font-medium text-emerald-800">
                          {vm.client.name || vm.client.email}
                        </span>
                        {vm.client.email && vm.client.name && (
                          <span className="text-xs text-emerald-600 ml-2">{vm.client.email}</span>
                        )}
                      </div>
                      <a
                        href={`/admin/crm/contacts/${vm.client.id}`}
                        className="ml-auto text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        {t('voip.voicemail.viewContact') || 'View Contact'}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {filteredVoicemails.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
            <Voicemail className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            {filter !== 'all'
              ? t('voip.voicemail.noResults') || 'No voicemails match your filter'
              : t('voip.voicemail.empty')}
          </div>
        )}
      </div>
    </div>
  );
}
