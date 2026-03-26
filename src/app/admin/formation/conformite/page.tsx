'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, StatCard, DataTable, StatusBadge, EmptyState, type Column } from '@/components/admin';
import { AlertTriangle, Clock, ShieldCheck, Award } from 'lucide-react';

interface ComplianceStats {
  totalOverdue: number;
  upcomingDeadlines: number;
  complianceRate: number;
  totalUfcEarned: number;
}

interface ComplianceRow {
  id: string;
  userId: string;
  status: string;
  complianceStatus: string | null;
  complianceDeadline: string | null;
  progress: number | string;
  course: { id: string; title: string };
  enrolledAt: string;
}

const complianceVariants: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  OVERDUE: 'error',
  EXEMPT: 'warning',
};

export default function CompliancePage() {
  const { t } = useTranslations();

  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [enrollments, setEnrollments] = useState<ComplianceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompliance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lms/compliance');
      const data = await res.json();
      const result = data.data ?? data;
      setStats(result.stats ?? null);
      setEnrollments(result.enrollments ?? []);
    } catch {
      setStats(null);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompliance(); }, [fetchCompliance]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  const columns: Column<ComplianceRow>[] = [
    {
      key: 'userId',
      header: t('admin.lms.studentName'),
      render: (row) => <span className="font-medium text-[var(--k-text-primary)]">{row.userId.slice(0, 12)}...</span>,
    },
    {
      key: 'course',
      header: t('admin.lms.courseName'),
      render: (row) => row.course?.title ?? '—',
    },
    {
      key: 'complianceDeadline',
      header: t('admin.lms.deadline'),
      render: (row) => {
        const deadline = row.complianceDeadline;
        if (!deadline) return '—';
        const isOverdue = new Date(deadline) < new Date();
        return (
          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
            {formatDate(deadline)}
          </span>
        );
      },
    },
    {
      key: 'complianceStatus',
      header: t('common.status'),
      render: (row) => {
        const cs = row.complianceStatus ?? 'NOT_STARTED';
        return (
          <StatusBadge variant={complianceVariants[cs] ?? 'neutral'}>
            {t(`admin.lms.complianceStatus.${cs.toLowerCase()}`) || cs}
          </StatusBadge>
        );
      },
    },
    {
      key: 'progress',
      header: t('admin.lms.progress'),
      render: (row) => {
        const pct = typeof row.progress === 'string' ? parseFloat(row.progress) : row.progress;
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{pct.toFixed(0)}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.complianceTitle')}
        subtitle={t('admin.lms.complianceSubtitle')}
        backHref="/admin/formation"
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('admin.lms.overdueTrainings')}
          value={loading ? '—' : stats?.totalOverdue ?? 0}
          icon={AlertTriangle}
        />
        <StatCard
          label={t('admin.lms.upcomingDeadlines')}
          value={loading ? '—' : stats?.upcomingDeadlines ?? 0}
          icon={Clock}
        />
        <StatCard
          label={t('admin.lms.complianceRate')}
          value={loading ? '—' : `${stats?.complianceRate ?? 0}%`}
          icon={ShieldCheck}
        />
        <StatCard
          label={t('admin.lms.ufcEarned')}
          value={loading ? '—' : stats?.totalUfcEarned ?? 0}
          icon={Award}
        />
      </div>

      {/* Table */}
      {!loading && enrollments.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t('admin.lms.noComplianceData')}
          description={t('admin.lms.noComplianceDataDesc')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={enrollments}
          keyExtractor={(e) => e.id}
          loading={loading}
          emptyTitle={t('admin.lms.noComplianceData')}
        />
      )}
    </div>
  );
}
