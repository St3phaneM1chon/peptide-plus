'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Download,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  Eye,
} from 'lucide-react';

import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatCard } from '@/components/admin/StatCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { Input } from '@/components/admin/FormField';
import { useI18n } from '@/i18n/client';

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

const levelVariant: Record<string, 'info' | 'warning' | 'error' | 'neutral'> = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  DEBUG: 'neutral',
};

export default function LogsPage() {
  const { t, locale } = useI18n();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ level: '', search: '', action: '' });
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchLogs();
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 10000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      setLogs(data.logs || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching logs:', err);
      setLogs([]);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    if (filter.level && log.level !== filter.level) return false;
    if (filter.action && !log.action.toLowerCase().includes(filter.action.toLowerCase())) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!log.action.toLowerCase().includes(search) &&
          !log.userName?.toLowerCase().includes(search) &&
          !JSON.stringify(log.details).toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: logs.length,
    info: logs.filter(l => l.level === 'INFO').length,
    errors: logs.filter(l => l.level === 'ERROR').length,
    warnings: logs.filter(l => l.level === 'WARNING').length,
  };

  const actionLabels: Record<string, string> = {
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
  };

  const columns: Column<LogEntry>[] = [
    {
      key: 'timestamp',
      header: t('admin.logs.colTimestamp'),
      sortable: true,
      render: (log) => (
        <span className="text-slate-500">
          {new Date(log.timestamp).toLocaleString(locale)}
        </span>
      ),
    },
    {
      key: 'level',
      header: t('admin.logs.colLevel'),
      align: 'center',
      render: (log) => (
        <StatusBadge variant={levelVariant[log.level]}>
          {log.level}
        </StatusBadge>
      ),
    },
    {
      key: 'action',
      header: t('admin.logs.colAction'),
      render: (log) => (
        <div>
          <p className="text-slate-900">{actionLabels[log.action] || log.action}</p>
          <code className="text-xs text-slate-400">{log.action}</code>
        </div>
      ),
    },
    {
      key: 'userName',
      header: t('admin.logs.colUser'),
      render: (log) => (
        <span className="text-slate-600">{log.userName || '-'}</span>
      ),
    },
    {
      key: 'ipAddress',
      header: t('admin.logs.colIp'),
      render: (log) => (
        <span className="text-slate-500">{log.ipAddress || '-'}</span>
      ),
    },
    {
      key: 'details',
      header: t('admin.logs.colDetails'),
      align: 'center',
      render: (log) => log.details ? (
        <Button variant="ghost" size="sm" icon={Eye} onClick={() => setSelectedLog(log)}>
          {t('admin.logs.view')}
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.logs.title')}
        subtitle={t('admin.logs.subtitle')}
        actions={
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
            <Button variant="secondary" icon={RefreshCw} onClick={fetchLogs}>
              {t('admin.logs.refresh')}
            </Button>
            <Button variant="secondary" icon={Download}>
              {t('admin.logs.export')}
            </Button>
            {lastUpdated && (
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {t('admin.logs.lastUpdated') || 'Last updated'}: {lastUpdated.toLocaleTimeString(locale)}
              </span>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label={t('admin.logs.total24h')} value={stats.total} icon={FileText} />
        <StatCard label={t('admin.logs.info')} value={stats.info} icon={Info} />
        <StatCard label={t('admin.logs.warnings')} value={stats.warnings} icon={AlertTriangle} />
        <StatCard label={t('admin.logs.errors')} value={stats.errors} icon={AlertCircle} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(v) => setFilter({ ...filter, search: v })}
        searchPlaceholder={t('admin.logs.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.logs.allLevels')}
          value={filter.level}
          onChange={(v) => setFilter({ ...filter, level: v })}
          options={[
            { value: 'INFO', label: 'Info' },
            { value: 'WARNING', label: 'Warning' },
            { value: 'ERROR', label: 'Error' },
            { value: 'DEBUG', label: 'Debug' },
          ]}
        />
        <Input
          type="text"
          placeholder={t('admin.logs.filterByAction')}
          value={filter.action}
          onChange={(e) => setFilter({ ...filter, action: e.target.value })}
          className="!w-48"
        />
      </FilterBar>

      {/* Logs Table */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        keyExtractor={(log) => log.id}
        loading={loading}
        emptyTitle={t('admin.logs.emptyTitle')}
        emptyDescription={t('admin.logs.emptyDescription')}
      />

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? (actionLabels[selectedLog.action] || selectedLog.action) : ''}
        subtitle={selectedLog ? new Date(selectedLog.timestamp).toLocaleString(locale) : ''}
      >
        <pre className="bg-slate-50 rounded-lg p-4 text-sm overflow-x-auto">
          {selectedLog && JSON.stringify(selectedLog, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
