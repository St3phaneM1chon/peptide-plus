'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, DataTable, StatusBadge, EmptyState, type Column } from '@/components/admin';
import { FilterBar, SelectFilter } from '@/components/admin';
import { Users } from 'lucide-react';

interface EnrollmentRow {
  id: string;
  userId: string;
  status: string;
  progress: number | string;
  enrolledAt: string;
  completedAt: string | null;
  course: { id: string; title: string; slug: string };
}

const statusVariants: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  ACTIVE: 'info',
  COMPLETED: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'error',
  EXPIRED: 'neutral',
};

export default function EnrollmentsPage() {
  const { t } = useTranslations();

  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courses, setCourses] = useState<{ value: string; label: string }[]>([]);

  // Load course options for filter
  useEffect(() => {
    fetch('/api/admin/lms/courses?limit=100')
      .then(res => res.json())
      .then(data => {
        const courseList = data.data?.courses ?? data.courses ?? [];
        setCourses(courseList.map((c: { id: string; title: string }) => ({
          value: c.id,
          label: c.title,
        })));
      })
      .catch(() => { /* silently fail */ });
  }, []);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: '1', limit: '50' });
    if (courseFilter) params.set('courseId', courseFilter);
    if (statusFilter) params.set('status', statusFilter);

    try {
      const res = await fetch(`/api/admin/lms/enrollments?${params}`);
      const data = await res.json();
      const enrollmentsList = data.data?.enrollments ?? data.enrollments ?? [];
      setEnrollments(enrollmentsList);
      setTotal(data.data?.total ?? data.total ?? 0);
    } catch {
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, [courseFilter, statusFilter]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  };

  const columns: Column<EnrollmentRow>[] = [
    {
      key: 'userId',
      header: t('admin.lms.studentName'),
      render: (row) => (
        <span className="font-medium text-[var(--k-text-primary)]">{row.userId.slice(0, 12)}...</span>
      ),
    },
    {
      key: 'course',
      header: t('admin.lms.courseName'),
      render: (row) => row.course?.title ?? '—',
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <StatusBadge variant={statusVariants[row.status] ?? 'neutral'}>
          {t(`admin.lms.enrollmentStatus.${row.status.toLowerCase()}`) || row.status}
        </StatusBadge>
      ),
    },
    {
      key: 'progress',
      header: t('admin.lms.progress'),
      render: (row) => {
        const pct = typeof row.progress === 'string' ? parseFloat(row.progress) : row.progress;
        return (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
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
    {
      key: 'enrolledAt',
      header: t('admin.lms.enrolledAt'),
      render: (row) => formatDate(row.enrolledAt),
    },
    {
      key: 'completedAt',
      header: t('admin.lms.completedAt'),
      render: (row) => formatDate(row.completedAt),
    },
  ];

  const statusOptions = [
    { value: 'ACTIVE', label: t('admin.lms.enrollmentStatus.active') },
    { value: 'COMPLETED', label: t('admin.lms.enrollmentStatus.completed') },
    { value: 'SUSPENDED', label: t('admin.lms.enrollmentStatus.suspended') },
    { value: 'CANCELLED', label: t('admin.lms.enrollmentStatus.cancelled') },
    { value: 'EXPIRED', label: t('admin.lms.enrollmentStatus.expired') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.enrollments')}
        subtitle={`${total} ${t('admin.lms.enrollmentsTotal')}`}
        backHref="/admin/formation"
      />

      <FilterBar>
        <SelectFilter
          label={t('admin.lms.allCourses')}
          value={courseFilter}
          onChange={setCourseFilter}
          options={courses}
        />
        <SelectFilter
          label={t('admin.lms.allStatuses')}
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
      </FilterBar>

      {!loading && enrollments.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('admin.lms.noEnrollments')}
          description={t('admin.lms.noEnrollmentsDesc')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={enrollments}
          keyExtractor={(e) => e.id}
          loading={loading}
          emptyTitle={t('admin.lms.noEnrollments')}
        />
      )}
    </div>
  );
}
