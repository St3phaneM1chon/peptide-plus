'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Phone,
  Mail,
  MessageSquare,
  Video,
  ChevronDown,
  ChevronUp,
  Loader2,
  Inbox,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface Activity {
  id: string;
  type: string; // CALL, EMAIL, SMS, MEETING, NOTE
  title: string;
  description?: string | null;
  date: string;
  leadName?: string | null;
  dealName?: string | null;
}

interface PaginatedResponse {
  data: Activity[];
  total: number;
  page: number;
  pageSize: number;
}

interface RepCommunicationsHubProps {
  agentId: string;
  period: string;
}

// ── Tab config ──────────────────────────────────────────────────

const TABS = [
  { key: '', label: 'All', labelKey: 'common.all' },
  { key: 'CALL', label: 'Calls', labelKey: 'admin.crm.comm.calls' },
  { key: 'EMAIL', label: 'Emails', labelKey: 'admin.crm.comm.emails' },
  { key: 'SMS', label: 'SMS', labelKey: 'admin.crm.comm.sms' },
  { key: 'MEETING', label: 'Meetings', labelKey: 'admin.crm.comm.meetings' },
] as const;

// ── Icon map ────────────────────────────────────────────────────

const TYPE_ICON_MAP: Record<string, { icon: typeof Phone; color: string }> = {
  CALL: { icon: Phone, color: 'text-green-500 bg-green-100 dark:bg-green-900' },
  EMAIL: { icon: Mail, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900' },
  SMS: { icon: MessageSquare, color: 'text-purple-500 bg-purple-100 dark:bg-purple-900' },
  MEETING: { icon: Video, color: 'text-orange-500 bg-orange-100 dark:bg-orange-900' },
};

const DEFAULT_ICON = { icon: MessageSquare, color: 'text-gray-500 bg-gray-100 dark:bg-gray-700' };

const PAGE_SIZE = 10;

// ── Component ───────────────────────────────────────────────────

export default function RepCommunicationsHub({ agentId, period }: RepCommunicationsHubProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const typeParam = activeTab ? `&type=${activeTab}` : '';
      const res = await fetch(
        `/api/admin/crm/reps/${agentId}/dashboard?section=communications&period=${period}&page=${page}&pageSize=${PAGE_SIZE}${typeParam}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PaginatedResponse = await res.json();
      setActivities(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [agentId, period, activeTab, page]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Reset page when tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-4">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t(tab.labelKey) || tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-500 dark:text-gray-400">{t('common.loading') || 'Loading...'}</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('admin.crm.comm.empty') || 'No activities found for this period.'}
            </p>
          </div>
        ) : (
          <>
            {/* Timeline list */}
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {activities.map((activity) => {
                const { icon: Icon, color } = TYPE_ICON_MAP[activity.type] ?? DEFAULT_ICON;
                const isExpanded = expandedId === activity.id;

                return (
                  <li key={activity.id} className="py-3">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : activity.id)}
                      className="w-full flex items-start gap-3 text-left"
                    >
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full ${color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {activity.title}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                              {formatDate(activity.date)}
                            </span>
                            {activity.description && (
                              isExpanded
                                ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                : <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {!isExpanded && activity.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {activity.description}
                          </p>
                        )}

                        {isExpanded && activity.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                            {activity.description}
                          </p>
                        )}

                        {(activity.leadName || activity.dealName) && (
                          <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                            {activity.leadName && <span>{activity.leadName}</span>}
                            {activity.leadName && activity.dealName && <span> / </span>}
                            {activity.dealName && <span>{activity.dealName}</span>}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700 mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('common.page') || 'Page'} {page} / {totalPages} ({total} {t('common.total') || 'total'})
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
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
