'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { addCSRFHeader } from '@/lib/csrf';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Check,
  Plus,
  X,
  Loader2,
  CalendarClock,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface FollowUp {
  id: string;
  type: string; // RETENTION, UPSELL, CHECK_IN, etc.
  status: string; // PENDING, COMPLETED, OVERDUE
  scheduledDate: string;
  interval?: string | null; // 3mo, 6mo, etc.
  leadName?: string | null;
  dealName?: string | null;
  notes?: string | null;
}

interface RepFollowUpCalendarProps {
  agentId: string;
  period: string;
}

// ── Type badge colors ───────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  RETENTION: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  UPSELL: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  CHECK_IN: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  RENEWAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  ONBOARDING: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const DEFAULT_TYPE_COLOR = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';

// ── Section config ──────────────────────────────────────────────

const SECTIONS = [
  {
    key: 'OVERDUE',
    label: 'Overdue',
    labelKey: 'admin.crm.followups.overdue',
    icon: AlertTriangle,
    headerBg: 'bg-red-50 dark:bg-red-900/30',
    headerText: 'text-red-700 dark:text-red-300',
    badgeBg: 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200',
  },
  {
    key: 'PENDING',
    label: 'Pending',
    labelKey: 'admin.crm.followups.pending',
    icon: Clock,
    headerBg: 'bg-yellow-50 dark:bg-yellow-900/30',
    headerText: 'text-yellow-700 dark:text-yellow-300',
    badgeBg: 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200',
  },
  {
    key: 'COMPLETED',
    label: 'Completed',
    labelKey: 'admin.crm.followups.completed',
    icon: CheckCircle2,
    headerBg: 'bg-green-50 dark:bg-green-900/30',
    headerText: 'text-green-700 dark:text-green-300',
    badgeBg: 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200',
  },
] as const;

// ── Component ───────────────────────────────────────────────────

export default function RepFollowUpCalendar({ agentId, period }: RepFollowUpCalendarProps) {
  const { t } = useI18n();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState({ type: 'CHECK_IN', scheduledDate: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/crm/reps/${agentId}/dashboard?section=followups&period=${period}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setFollowUps(json.data ?? json ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  }, [agentId, period]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const handleComplete = async (followUpId: string) => {
    setCompleting(followUpId);
    try {
      const res = await fetch(
        `/api/admin/crm/reps/${agentId}/follow-ups?followUpId=${followUpId}`,
        {
          method: 'PATCH',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: 'COMPLETED' }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Update local state
      setFollowUps((prev) =>
        prev.map((fu) => (fu.id === followUpId ? { ...fu, status: 'COMPLETED' } : fu))
      );
    } catch {
      // Silently fail — user can retry
    } finally {
      setCompleting(null);
    }
  };

  const handleAddFollowUp = async () => {
    if (!newFollowUp.scheduledDate) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/crm/reps/${agentId}/follow-ups`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(newFollowUp),
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewFollowUp({ type: 'CHECK_IN', scheduledDate: '', notes: '' });
        fetchFollowUps();
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  };

  // Group follow-ups by status
  const grouped = SECTIONS.map((section) => ({
    ...section,
    items: followUps.filter((fu) => {
      if (section.key === 'OVERDUE') {
        return fu.status === 'OVERDUE' || (fu.status === 'PENDING' && new Date(fu.scheduledDate) < new Date());
      }
      return fu.status === section.key;
    }),
  }));

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">{t('common.loading') || 'Loading...'}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center text-red-500">{error}</div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('admin.crm.followups.title') || 'Follow-ups'}
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAddForm ? (t('common.cancel') || 'Cancel') : (t('admin.crm.followups.add') || 'Add Follow-up')}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={newFollowUp.type}
              onChange={(e) => setNewFollowUp((prev) => ({ ...prev, type: e.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100"
            >
              <option value="CHECK_IN">{t('admin.crm.reps.followup.types.CHECK_IN')}</option>
              <option value="RETENTION">{t('admin.crm.reps.followup.types.RETENTION')}</option>
              <option value="UPSELL">{t('admin.crm.reps.followup.types.UPSELL')}</option>
              <option value="RENEWAL">{t('admin.crm.reps.followup.types.RENEWAL')}</option>
              <option value="ANNIVERSARY">{t('admin.crm.reps.followup.types.ANNIVERSARY')}</option>
            </select>
            <input
              type="date"
              value={newFollowUp.scheduledDate}
              onChange={(e) => setNewFollowUp((prev) => ({ ...prev, scheduledDate: e.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100"
            />
            <input
              type="text"
              placeholder={t('admin.crm.followups.notesPlaceholder') || 'Notes...'}
              value={newFollowUp.notes}
              onChange={(e) => setNewFollowUp((prev) => ({ ...prev, notes: e.target.value }))}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleAddFollowUp}
              disabled={!newFollowUp.scheduledDate || submitting}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (t('common.saving') || 'Saving...') : (t('common.save') || 'Save')}
            </button>
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {grouped.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.key}>
              {/* Section header */}
              <div className={`px-4 py-2.5 flex items-center gap-2 ${section.headerBg}`}>
                <SectionIcon className={`w-4 h-4 ${section.headerText}`} />
                <span className={`text-sm font-medium ${section.headerText}`}>
                  {t(section.labelKey) || section.label}
                </span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${section.badgeBg}`}>
                  {section.items.length}
                </span>
              </div>

              {/* Items */}
              {section.items.length === 0 ? (
                <div className="px-4 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  {t('admin.crm.followups.noItems') || 'No items'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {section.items.map((fu) => (
                    <li key={fu.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[fu.type] ?? DEFAULT_TYPE_COLOR}`}>
                            {fu.type}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(fu.scheduledDate)}
                          </span>
                          {fu.interval && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              ({fu.interval})
                            </span>
                          )}
                        </div>
                        {(fu.leadName || fu.dealName) && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            {fu.leadName}{fu.leadName && fu.dealName ? ' — ' : ''}{fu.dealName}
                          </p>
                        )}
                        {fu.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {fu.notes}
                          </p>
                        )}
                      </div>

                      {/* Complete button for PENDING/OVERDUE */}
                      {section.key !== 'COMPLETED' && (
                        <button
                          onClick={() => handleComplete(fu.id)}
                          disabled={completing === fu.id}
                          className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 disabled:opacity-50 transition-colors"
                        >
                          {completing === fu.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          {t('admin.crm.followups.complete') || 'Complete'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state when no follow-ups at all */}
      {followUps.length === 0 && (
        <div className="p-8 text-center">
          <CalendarClock className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {t('admin.crm.followups.empty') || 'No follow-ups scheduled.'}
          </p>
        </div>
      )}
    </div>
  );
}
