'use client';

import { useState, useCallback } from 'react';
import {
  Phone, Mail, MessageSquare, Calendar, ArrowRightLeft, Plus,
  CheckCircle2, XCircle, Send, Filter, ChevronDown,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// --- Types ---

export interface Activity {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  performedBy: { name: string | null; email: string };
  createdAt: string;
}

interface ActivityTimelineProps {
  activities: Activity[];
  leadId?: string;
  dealId?: string;
  onActivityAdded?: () => void;
  locale?: string;
  bare?: boolean; // Skip outer card wrapper (for embedding in tabs)
}

// --- Icon & color mapping ---

const ACTIVITY_CONFIG: Record<string, { icon: typeof Phone; color: string; bg: string }> = {
  CALL:           { icon: Phone,         color: 'text-green-600',  bg: 'bg-green-100' },
  EMAIL:          { icon: Mail,          color: 'text-teal-600',   bg: 'bg-teal-100' },
  SMS:            { icon: Send,          color: 'text-purple-600', bg: 'bg-purple-100' },
  MEETING:        { icon: Calendar,      color: 'text-indigo-600', bg: 'bg-indigo-100' },
  NOTE:           { icon: MessageSquare, color: 'text-amber-600',  bg: 'bg-amber-100' },
  STATUS_CHANGE:  { icon: ArrowRightLeft,color: 'text-gray-600',   bg: 'bg-gray-200' },
  DEAL_CREATED:   { icon: Plus,          color: 'text-teal-600',   bg: 'bg-teal-100' },
  DEAL_WON:       { icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-100' },
  DEAL_LOST:      { icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-100' },
};

const DEFAULT_CONFIG = { icon: MessageSquare, color: 'text-gray-500', bg: 'bg-gray-100' };

const ACTIVITY_TYPES = ['ALL', 'CALL', 'EMAIL', 'SMS', 'MEETING', 'NOTE', 'STATUS_CHANGE'] as const;

const QUICK_ADD_TYPES = [
  { type: 'NOTE', labelKey: 'admin.crm.addNote', icon: MessageSquare },
  { type: 'CALL', labelKey: 'admin.crm.logCall', icon: Phone },
  { type: 'EMAIL', labelKey: 'admin.crm.logEmail', icon: Mail },
  { type: 'MEETING', labelKey: 'admin.crm.logMeeting', icon: Calendar },
] as const;

// --- Component ---

export function ActivityTimeline({ activities, leadId, dealId, onActivityAdded, locale, bare }: ActivityTimelineProps) {
  const { t, locale: ctxLocale } = useI18n();
  const loc = locale || ctxLocale;
  const [filter, setFilter] = useState<string>('ALL');
  const [showFilter, setShowFilter] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAddDesc, setQuickAddDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = filter === 'ALL'
    ? activities
    : activities.filter(a => a.type === filter);

  const submitActivity = useCallback(async (type: string) => {
    if (!quickAddTitle.trim()) {
      toast.error(t('common.required') || 'Title required');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        type,
        title: quickAddTitle.trim(),
      };
      if (quickAddDesc.trim()) body.description = quickAddDesc.trim();
      if (leadId) body.leadId = leadId;
      if (dealId) body.dealId = dealId;

      const res = await fetch('/api/admin/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t('admin.crm.activityAdded') || 'Activity added');
        setShowQuickAdd(null);
        setQuickAddTitle('');
        setQuickAddDesc('');
        onActivityAdded?.();
      } else {
        toast.error(json.error?.message || 'Failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  }, [quickAddTitle, quickAddDesc, leadId, dealId, t, onActivityAdded]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMin < 1) return t('common.justNow') || 'Just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString(loc);
  };

  return (
    <div className={bare ? '' : 'bg-white rounded-lg border'}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 ${bare ? 'pb-2' : 'border-b'}`}>
        <h3 className="text-sm font-semibold text-gray-700">
          {t('admin.crm.timeline') || 'Timeline'}
          <span className="ml-1.5 text-xs font-normal text-gray-400">({filtered.length})</span>
        </h3>
        <div className="flex items-center gap-1.5">
          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                filter !== 'ALL'
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Filter className="h-3 w-3" />
              {filter === 'ALL' ? t('common.filter') || 'Filter' : filter}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border py-1 min-w-[140px]">
                {ACTIVITY_TYPES.map(type => {
                  const cfg = type === 'ALL' ? null : ACTIVITY_CONFIG[type];
                  const Icon = cfg?.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => { setFilter(type); setShowFilter(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${
                        filter === type ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {Icon && <Icon className={`h-3 w-3 ${cfg?.color || ''}`} />}
                      {type === 'ALL' ? t('common.all') || 'All' : type.replace('_', ' ')}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Add buttons */}
          <div className="flex items-center gap-0.5 ml-1">
            {QUICK_ADD_TYPES.map(({ type, labelKey, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setShowQuickAdd(showQuickAdd === type ? null : type)}
                title={t(labelKey) || type}
                className={`p-1.5 rounded-md transition-colors ${
                  showQuickAdd === type
                    ? 'bg-teal-100 text-teal-700'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Add Form */}
      {showQuickAdd && (
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            {(() => {
              const cfg = ACTIVITY_CONFIG[showQuickAdd] || DEFAULT_CONFIG;
              const Icon = cfg.icon;
              return <span className={`p-1 rounded ${cfg.bg}`}><Icon className={`h-3.5 w-3.5 ${cfg.color}`} /></span>;
            })()}
            <span className="text-xs font-medium text-gray-600">
              {t(QUICK_ADD_TYPES.find(q => q.type === showQuickAdd)?.labelKey || '') || showQuickAdd}
            </span>
          </div>
          <input
            type="text"
            value={quickAddTitle}
            onChange={e => setQuickAddTitle(e.target.value)}
            placeholder={t('admin.crm.activityTitle') || 'Title...'}
            className="w-full border rounded-md px-3 py-1.5 text-sm mb-2 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitActivity(showQuickAdd); } }}
          />
          <textarea
            value={quickAddDesc}
            onChange={e => setQuickAddDesc(e.target.value)}
            placeholder={t('admin.crm.activityDescription') || 'Notes (optional)...'}
            className="w-full border rounded-md px-3 py-1.5 text-sm resize-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
            rows={2}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setShowQuickAdd(null); setQuickAddTitle(''); setQuickAddDesc(''); }}
              className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded-md"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              onClick={() => submitActivity(showQuickAdd)}
              disabled={submitting || !quickAddTitle.trim()}
              className="px-3 py-1 text-xs text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? '...' : t('common.save') || 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="px-4 py-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            {t('admin.crm.noActivities') || 'No activities yet'}
          </p>
        ) : (
          <div className="space-y-0">
            {filtered.map((activity, idx) => {
              const cfg = ACTIVITY_CONFIG[activity.type] || DEFAULT_CONFIG;
              const Icon = cfg.icon;
              const isLast = idx === filtered.length - 1;

              return (
                <div key={activity.id} className="flex gap-3 group">
                  {/* Timeline line + icon */}
                  <div className="flex flex-col items-center">
                    <div className={`p-1.5 rounded-full ${cfg.bg} transition-shadow group-hover:ring-2 group-hover:ring-gray-200`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </div>
                    {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-900 leading-snug">{activity.title}</p>
                      <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                        {formatTime(activity.createdAt)}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{activity.description}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {activity.performedBy.name || activity.performedBy.email}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
