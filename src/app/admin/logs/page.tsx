'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Download,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react';

import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem, ContentListGroup } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

// ── Types ─────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  action: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────

function levelBadgeVariant(level: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (level) {
    case 'INFO': return 'info';
    case 'WARNING': return 'warning';
    case 'ERROR': return 'error';
    case 'DEBUG': return 'neutral';
    default: return 'neutral';
  }
}

function levelIcon(level: string): string {
  switch (level) {
    case 'INFO': return 'I';
    case 'WARNING': return '!';
    case 'ERROR': return 'X';
    case 'DEBUG': return 'D';
    default: return '?';
  }
}

function levelAvatarColor(level: string): string {
  switch (level) {
    case 'INFO': return '#0284c7';
    case 'WARNING': return '#d97706';
    case 'ERROR': return '#dc2626';
    case 'DEBUG': return '#64748b';
    default: return '#94a3b8';
  }
}

/** Group log entries by date buckets */
function groupLogsByDate(
  logs: LogEntry[],
  actionLabels: Record<string, string>,
  dateLabels: { today: string; yesterday: string; thisWeek: string; older: string },
): ContentListGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const buckets: Record<string, LogEntry[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  for (const log of logs) {
    const d = new Date(log.timestamp);
    if (d >= today) {
      buckets.today.push(log);
    } else if (d >= yesterday) {
      buckets.yesterday.push(log);
    } else if (d >= weekAgo) {
      buckets.thisWeek.push(log);
    } else {
      buckets.older.push(log);
    }
  }

  const toItem = (log: LogEntry): ContentListItem => ({
    id: log.id,
    avatar: { text: levelIcon(log.level), color: levelAvatarColor(log.level) },
    title: actionLabels[log.action] || log.action,
    subtitle: log.userName || '-',
    preview: log.details
      ? Object.entries(log.details).slice(0, 2).map(([k, v]) => `${k}: ${String(v)}`).join(', ')
      : log.action,
    timestamp: log.timestamp,
    badges: [
      { text: log.level, variant: levelBadgeVariant(log.level) },
    ],
  });

  const groups: ContentListGroup[] = [];

  if (buckets.today.length > 0) {
    groups.push({ label: dateLabels.today, items: buckets.today.map(toItem), defaultOpen: true });
  }
  if (buckets.yesterday.length > 0) {
    groups.push({ label: dateLabels.yesterday, items: buckets.yesterday.map(toItem), defaultOpen: true });
  }
  if (buckets.thisWeek.length > 0) {
    groups.push({ label: dateLabels.thisWeek, items: buckets.thisWeek.map(toItem), defaultOpen: true });
  }
  if (buckets.older.length > 0) {
    groups.push({ label: dateLabels.older, items: buckets.older.map(toItem), defaultOpen: false });
  }

  return groups;
}

// ── Main Component ────────────────────────────────────────────

export default function LogsPage() {
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  // ─── Data fetching ──────────────────────────────────────────

  // FAILLE-031 FIX: Wrap fetchLogs in useCallback with proper dependencies
  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (levelFilter && levelFilter !== 'all') params.set('level', levelFilter);
      if (searchValue) params.set('search', searchValue);
      const qs = params.toString();
      const res = await fetch(`/api/admin/logs${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching logs:', err);
      toast.error(t('common.errorOccurred'));
      setLogs([]);
    }
    setLoading(false);
  }, [levelFilter, searchValue, t]);

  useEffect(() => {
    fetchLogs();
    if (autoRefresh) {
      // FAILLE-030 FIX: Add jitter to auto-refresh interval to prevent thundering herd
      const jitter = Math.floor(Math.random() * 3000); // 0-3s jitter
      const interval = setInterval(fetchLogs, 10000 + jitter);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh, fetchLogs]);

  const handleSelectLog = useCallback((id: string) => {
    setSelectedLogId(id);
  }, []);

  // FAILLE-029 FIX: Sanitize CSV values to prevent Excel formula injection
  const sanitizeCSVValue = useCallback((val: string): string => {
    // If value starts with =, +, -, @, tab, or CR, prefix with single quote to neutralize formula
    if (/^[=+\-@\t\r]/.test(val)) {
      return `'${val}`;
    }
    return val;
  }, []);

  const handleExportCSV = useCallback(() => {
    if (filteredLogs.length === 0) return;
    // FIX: FAILLE-071 - Limit CSV export to 5000 entries to prevent browser memory issues
    const exportLogs = filteredLogs.slice(0, 5000);
    const headers = ['Timestamp', 'Level', 'Action', 'User', 'IP', 'Details'];
    const rows = exportLogs.map((log) => [
      new Date(log.timestamp).toLocaleString(locale),
      log.level,
      log.action,
      log.userName || '-',
      log.ipAddress || '-',
      log.details ? JSON.stringify(log.details) : '',
    ]);
    const BOM = '\uFEFF';
    const csv = BOM + [headers, ...rows].map((r) => r.map((v) => `"${sanitizeCSVValue(String(v)).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs, locale, sanitizeCSVValue]);

  // ─── Action labels (i18n) ──────────────────────────────────

  const actionLabels: Record<string, string> = useMemo(() => ({
    USER_LOGIN: t('admin.logs.actionUserLogin'),
    ADMIN_LOGIN: t('admin.logs.actionAdminLogin'),
    ORDER_CREATED: t('admin.logs.actionOrderCreated'),
    ORDER_PAYMENT_SUCCESS: t('admin.logs.actionPaymentSuccess'),
    PAYMENT_RETRY: t('admin.logs.actionPaymentRetry'),
    EMAIL_SEND_FAILED: t('admin.logs.actionEmailFailed'),
    PROMO_CODE_USED: t('admin.logs.actionPromoUsed'),
    PRODUCT_UPDATED: t('admin.logs.actionProductUpdated'),
    LOW_STOCK_ALERT: t('admin.logs.actionLowStock'),
    CRON_JOB_RUN: t('admin.logs.actionCronJob'),
  }), [t]);

  // ─── Filtering ──────────────────────────────────────────────

  // TODO: FAILLE-068 - JSON.stringify(log.details) on every search keystroke is O(n*m).
  //       Pre-compute a searchable string per log entry during fetch for better performance.
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (
          !log.action.toLowerCase().includes(search) &&
          !log.userName?.toLowerCase().includes(search) &&
          !JSON.stringify(log.details).toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [logs, levelFilter, searchValue]);

  const stats = useMemo(() => ({
    total: logs.length,
    info: logs.filter(l => l.level === 'INFO').length,
    errors: logs.filter(l => l.level === 'ERROR').length,
    warnings: logs.filter(l => l.level === 'WARNING').length,
  }), [logs]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.logs.allLevels'), count: stats.total },
    { key: 'INFO', label: t('admin.logs.info'), count: stats.info },
    { key: 'WARNING', label: t('admin.logs.warnings'), count: stats.warnings },
    { key: 'ERROR', label: t('admin.logs.errors'), count: stats.errors },
  ], [t, stats]);

  const dateLabels = useMemo(() => ({
    today: t('admin.logs.today') || 'Today',
    yesterday: t('admin.logs.yesterday') || 'Yesterday',
    thisWeek: t('admin.logs.thisWeek') || 'This Week',
    older: t('admin.logs.older') || 'Older',
  }), [t]);

  const logGroups = useMemo(() => groupLogsByDate(filteredLogs, actionLabels, dateLabels), [filteredLogs, actionLabels, dateLabels]);

  const selectedLog = useMemo(() => {
    return logs.find((l) => l.id === selectedLogId) || null;
  }, [logs, selectedLogId]);

  // ─── Ribbon action handlers ───────────────────────────────
  const handleRibbonLaunch = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonRefresh = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRibbonExport = useCallback(() => {
    handleExportCSV();
  }, [handleExportCSV]);

  const handleRibbonPurge = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonSettings = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  useRibbonAction('launch', handleRibbonLaunch);
  useRibbonAction('refresh', handleRibbonRefresh);
  useRibbonAction('export', handleRibbonExport);
  useRibbonAction('purge', handleRibbonPurge);
  useRibbonAction('settings', handleRibbonSettings);

  // ─── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.logs.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.logs.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
              />
              {t('admin.logs.autoRefresh')}
            </label>
            <Button variant="secondary" icon={RefreshCw} size="sm" onClick={fetchLogs}>
              {t('admin.logs.refresh')}
            </Button>
            <Button variant="secondary" icon={Download} size="sm" onClick={handleExportCSV}>
              {t('admin.logs.export')}
            </Button>
            {lastUpdated && (
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {t('admin.logs.lastUpdated') || 'Last updated'}: {lastUpdated.toLocaleTimeString(locale)}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label={t('admin.logs.total24h')} value={stats.total} icon={FileText} />
          <StatCard label={t('admin.logs.info')} value={stats.info} icon={Info} />
          <StatCard label={t('admin.logs.warnings')} value={stats.warnings} icon={AlertTriangle} />
          <StatCard label={t('admin.logs.errors')} value={stats.errors} icon={AlertCircle} />
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={420}
          showDetail={!!selectedLogId}
          list={
            <ContentList
              groups={logGroups}
              selectedId={selectedLogId}
              onSelect={handleSelectLog}
              filterTabs={filterTabs}
              activeFilter={levelFilter}
              onFilterChange={setLevelFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.logs.searchPlaceholder')}
              loading={loading}
              emptyIcon={FileText}
              emptyTitle={t('admin.logs.emptyTitle')}
              emptyDescription={t('admin.logs.emptyDescription')}
            />
          }
          detail={
            selectedLog ? (
              <DetailPane
                header={{
                  title: actionLabels[selectedLog.action] || selectedLog.action,
                  subtitle: new Date(selectedLog.timestamp).toLocaleString(locale),
                  avatar: { text: levelIcon(selectedLog.level), color: levelAvatarColor(selectedLog.level) },
                  onBack: () => setSelectedLogId(null),
                  backLabel: t('admin.logs.title'),
                }}
              >
                <div className="space-y-6">
                  {/* Level & Action */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedLog.level === 'ERROR' ? 'bg-red-100 text-red-800' :
                      selectedLog.level === 'WARNING' ? 'bg-amber-100 text-amber-800' :
                      selectedLog.level === 'INFO' ? 'bg-sky-100 text-sky-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {selectedLog.level}
                    </span>
                    <code className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {selectedLog.action}
                    </code>
                  </div>

                  {/* Metadata */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.logs.colDetails') || 'Metadata'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.logs.colUser')}</p>
                        <p className="text-slate-900">{selectedLog.userName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.logs.colUserId')}</p>
                        <p className="text-slate-700 font-mono text-sm">{selectedLog.userId || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.logs.colIp')}</p>
                        <p className="text-slate-700 font-mono text-sm">{selectedLog.ipAddress || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.logs.colTimestamp')}</p>
                        <p className="text-slate-700">{new Date(selectedLog.timestamp).toLocaleString(locale)}</p>
                      </div>
                    </div>
                    {selectedLog.userAgent && (
                      <div className="mt-4">
                        <p className="text-xs text-slate-500 mb-1">{t('admin.logs.colUserAgent')}</p>
                        <p className="text-slate-600 text-sm break-all">{selectedLog.userAgent}</p>
                      </div>
                    )}
                  </div>

                  {/* Details JSON */}
                  {selectedLog.details && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">{t('admin.logs.colDetails')}</h3>
                      <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm overflow-x-auto text-slate-700">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Full raw log */}
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.logs.view') || 'Raw Log'}</h3>
                    <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={FileText}
                emptyTitle={t('admin.logs.emptyTitle')}
                emptyDescription={t('admin.logs.emptyDescription')}
              />
            )
          }
        />
      </div>
    </div>
  );
}
