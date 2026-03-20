'use client';

/**
 * CustomerCommunications — Client 360 Communications Timeline
 *
 * Unified view of all communication history for a customer:
 * calls, voicemails, CRM activities (emails, SMS, notes, meetings).
 *
 * Fetches from: GET /api/admin/customers/[id]/communications
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Voicemail,
  Mail,
  MessageSquare,
  StickyNote,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Activity,
  Filter,
} from 'lucide-react';
import { StatusBadge, type BadgeVariant } from '@/components/admin/StatusBadge';
import { StatCard } from '@/components/admin/StatCard';
import { useI18n } from '@/i18n/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CallRecording {
  id: string;
  url: string | null;
  duration: number | null;
}

interface Transcription {
  summary: string | null;
  sentiment?: string | null;
  keywords?: string[];
  fullText: string | null;
}

interface TimelineCall {
  id: string;
  type: 'call';
  date: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL';
  status: string;
  duration: number | null;
  callerNumber: string;
  callerName: string | null;
  calledNumber: string;
  agentNotes: string | null;
  disposition: string | null;
  tags: string[];
  recording: CallRecording | null;
  transcription: Transcription | null;
}

interface TimelineVoicemail {
  id: string;
  type: 'voicemail';
  date: string;
  callerNumber: string;
  callerName: string | null;
  duration: number | null;
  transcription: Transcription | null;
  isRead: boolean;
  audioUrl: string | null;
}

interface TimelineActivity {
  id: string;
  type: string; // 'email' | 'sms' | 'note' | 'meeting' | 'status_change'
  date: string;
  title: string;
  description: string | null;
  performedBy: string | null;
  metadata: Record<string, unknown> | null;
}

type TimelineItem = TimelineCall | TimelineVoicemail | TimelineActivity;

interface CommunicationsStats {
  totalCalls: number;
  totalVoicemails: number;
  totalActivities: number;
  lastContactDate: string | null;
}

interface CommunicationsData {
  timeline: TimelineItem[];
  stats: CommunicationsStats;
}

type FilterType = 'all' | 'call' | 'voicemail' | 'email' | 'sms' | 'note' | 'meeting';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getCallDirectionIcon(direction: string) {
  switch (direction) {
    case 'INBOUND':
      return PhoneIncoming;
    case 'OUTBOUND':
      return PhoneOutgoing;
    default:
      return Phone;
  }
}

function getCallDirectionStyle(direction: string): string {
  switch (direction) {
    case 'INBOUND':
      return 'bg-indigo-50 text-indigo-600';
    case 'OUTBOUND':
      return 'bg-emerald-50 text-emerald-600';
    default:
      return 'bg-slate-50 text-slate-600';
  }
}

function getCallStatusBadge(status: string): BadgeVariant {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'MISSED':
    case 'FAILED':
      return 'error';
    case 'VOICEMAIL':
      return 'warning';
    case 'IN_PROGRESS':
    case 'RINGING':
      return 'info';
    case 'TRANSFERRED':
      return 'primary';
    default:
      return 'neutral';
  }
}

function getSentimentColor(sentiment: string | null | undefined): string {
  switch (sentiment) {
    case 'positive':
      return 'text-emerald-600 bg-emerald-50';
    case 'negative':
      return 'text-red-600 bg-red-50';
    case 'neutral':
      return 'text-slate-600 bg-slate-50';
    default:
      return '';
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'email':
      return Mail;
    case 'sms':
      return MessageSquare;
    case 'note':
      return StickyNote;
    case 'meeting':
      return Users;
    case 'status_change':
      return Activity;
    default:
      return StickyNote;
  }
}

function getActivityStyle(type: string): string {
  switch (type) {
    case 'email':
      return 'bg-blue-50 text-blue-600';
    case 'sms':
      return 'bg-purple-50 text-purple-600';
    case 'note':
      return 'bg-amber-50 text-amber-700';
    case 'meeting':
      return 'bg-teal-50 text-teal-600';
    case 'status_change':
      return 'bg-slate-50 text-slate-600';
    default:
      return 'bg-slate-50 text-slate-500';
  }
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: { key: FilterType; labelKey: string; icon: typeof Phone }[] = [
  { key: 'all', labelKey: 'all', icon: Filter },
  { key: 'call', labelKey: 'calls', icon: Phone },
  { key: 'voicemail', labelKey: 'voicemails', icon: Voicemail },
  { key: 'email', labelKey: 'emails', icon: Mail },
  { key: 'sms', labelKey: 'sms', icon: MessageSquare },
  { key: 'note', labelKey: 'notes', icon: StickyNote },
  { key: 'meeting', labelKey: 'meetings', icon: Users },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CallItem({
  item,
  locale,
  expanded,
  onToggle,
}: {
  item: TimelineCall;
  locale: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const DirIcon = getCallDirectionIcon(item.direction);
  const dirStyle = getCallDirectionStyle(item.direction);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${dirStyle}`}>
            <DirIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900">
              {item.direction === 'INBOUND' ? item.callerNumber : item.calledNumber}
              {item.callerName && (
                <span className="text-slate-500 ms-1">({item.callerName})</span>
              )}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className={item.direction === 'INBOUND' ? 'text-indigo-600' : 'text-emerald-600'}>
                {item.direction === 'INBOUND' ? 'Inbound' : item.direction === 'OUTBOUND' ? 'Outbound' : 'Internal'}
              </span>
              {item.duration != null && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {formatDuration(item.duration)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={getCallStatusBadge(item.status)}>
            {item.status.toLowerCase().replace('_', ' ')}
          </StatusBadge>
          {item.disposition && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
              {item.disposition.replace('_', ' ')}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {new Date(item.date).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
          </span>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex gap-1 mt-2">
          {item.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Transcription summary (always visible when present) */}
      {item.transcription?.summary && (
        <p className="text-sm text-slate-600 mt-2 italic">
          &ldquo;{item.transcription.summary}&rdquo;
          {item.transcription.sentiment && (
            <span className={`ms-2 text-xs px-2 py-0.5 rounded-full inline-block ${getSentimentColor(item.transcription.sentiment)}`}>
              {item.transcription.sentiment}
            </span>
          )}
        </p>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {item.agentNotes && (
            <div className="text-sm">
              <span className="font-medium text-slate-700">Agent notes: </span>
              <span className="text-slate-600">{item.agentNotes}</span>
            </div>
          )}

          {item.transcription?.keywords && item.transcription.keywords.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs font-medium text-slate-500">Keywords:</span>
              {item.transcription.keywords.map((kw) => (
                <span key={kw} className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {item.transcription?.fullText && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Transcription</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {item.transcription.fullText}
              </p>
            </div>
          )}

          {item.recording?.url && (
            <div className="mt-2">
              <audio
                src={`/api/admin/voip/recordings/${item.id}`}
                controls
                className="w-full h-8"
                preload="none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VoicemailItem({
  item,
  locale,
  expanded,
  onToggle,
}: {
  item: TimelineVoicemail;
  locale: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl border ${item.isRead ? 'border-slate-200' : 'border-amber-300 bg-amber-50/30'} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-50 text-amber-600">
            <Voicemail className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900">
              {item.callerNumber}
              {item.callerName && (
                <span className="text-slate-500 ms-1">({item.callerName})</span>
              )}
              {!item.isRead && (
                <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  New
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="text-amber-600">Voicemail</span>
              {item.duration != null && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {formatDuration(item.duration)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.audioUrl && (
            <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Play voicemail">
              <PlayCircle className="w-4 h-4 text-slate-500" />
            </button>
          )}
          <span className="text-xs text-slate-400">
            {new Date(item.date).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
          </span>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Transcription summary */}
      {item.transcription?.summary && (
        <p className="text-sm text-slate-600 mt-2 italic">
          &ldquo;{item.transcription.summary}&rdquo;
        </p>
      )}

      {/* Expanded: full transcription + audio player */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {item.transcription?.fullText && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Transcription</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {item.transcription.fullText}
              </p>
            </div>
          )}
          {item.audioUrl && (
            <audio
              src={item.audioUrl}
              controls
              className="w-full h-8"
              preload="none"
            />
          )}
        </div>
      )}
    </div>
  );
}

function ActivityItem({
  item,
  locale,
}: {
  item: TimelineActivity;
  locale: string;
}) {
  const Icon = getActivityIcon(item.type);
  const style = getActivityStyle(item.type);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${style}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900">{item.title}</div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="capitalize">{item.type.replace('_', ' ')}</span>
              {item.performedBy && (
                <span>by {item.performedBy}</span>
              )}
            </div>
          </div>
        </div>
        <span className="text-xs text-slate-400">
          {new Date(item.date).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </div>
      {item.description && (
        <p className="text-sm text-slate-600 mt-2 ms-12">{item.description}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CustomerCommunicationsProps {
  customerId: string;
}

export default function CustomerCommunications({ customerId }: CustomerCommunicationsProps) {
  const { locale } = useI18n();

  const [data, setData] = useState<CommunicationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async (typeFilter: FilterType) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/customers/${customerId}/communications?type=${typeFilter}&limit=100`
      );
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load communications');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) {
      fetchData(filter);
    }
  }, [customerId, filter, fetchData]);

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 text-sm">{error}</p>
        <button
          onClick={() => fetchData(filter)}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats;
  const timeline = data?.timeline || [];
  const totalComms = (stats?.totalCalls || 0) + (stats?.totalVoicemails || 0) + (stats?.totalActivities || 0);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Calls"
          value={stats?.totalCalls ?? 0}
          icon={Phone}
        />
        <StatCard
          label="Voicemails"
          value={stats?.totalVoicemails ?? 0}
          icon={Voicemail}
        />
        <StatCard
          label="Activities"
          value={stats?.totalActivities ?? 0}
          icon={Activity}
        />
        <StatCard
          label="Last Contact"
          value={
            stats?.lastContactDate
              ? new Date(stats.lastContactDate).toLocaleDateString(locale, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Never'
          }
          icon={Clock}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {FILTER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = filter === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="capitalize">{opt.labelKey}</span>
            </button>
          );
        })}
      </div>

      {/* Loading overlay for filter changes */}
      {loading && data && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      )}

      {/* Timeline */}
      {!loading && timeline.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {filter === 'all'
              ? 'No communications found for this customer'
              : `No ${filter} entries found`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {timeline.map((item) => {
            if (item.type === 'call') {
              return (
                <CallItem
                  key={item.id}
                  item={item as TimelineCall}
                  locale={locale}
                  expanded={expandedItems.has(item.id)}
                  onToggle={() => toggleExpanded(item.id)}
                />
              );
            }
            if (item.type === 'voicemail') {
              return (
                <VoicemailItem
                  key={item.id}
                  item={item as TimelineVoicemail}
                  locale={locale}
                  expanded={expandedItems.has(item.id)}
                  onToggle={() => toggleExpanded(item.id)}
                />
              );
            }
            // All other activity types
            return (
              <ActivityItem
                key={item.id}
                item={item as TimelineActivity}
                locale={locale}
              />
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {totalComms > 0 && (
        <p className="text-xs text-slate-400 text-center">
          Showing {timeline.length} of {totalComms} total communications
        </p>
      )}
    </div>
  );
}
