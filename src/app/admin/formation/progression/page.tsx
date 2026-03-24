'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, DataTable, StatusBadge, EmptyState, type Column } from '@/components/admin';
import { FilterBar } from '@/components/admin';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';

interface CourseEnrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  progress: number;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
}

interface StudentProgress {
  userId: string;
  userName: string;
  userEmail: string;
  enrollments: CourseEnrollment[];
  avgProgress: number;
  lastActivity: string | null;
  complianceStatus: 'compliant' | 'noncompliant' | 'noData';
}

export default function ProgressionPage() {
  const { t } = useTranslations();

  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '100', includeProgress: 'true' });
      const res = await fetch(`/api/admin/lms/enrollments?${params}`);
      const data = await res.json();
      const enrollmentsList = data.data?.enrollments ?? data.enrollments ?? [];

      // Group enrollments by user
      const byUser = new Map<string, StudentProgress>();
      for (const e of enrollmentsList) {
        const uid = e.userId;
        if (!byUser.has(uid)) {
          byUser.set(uid, {
            userId: uid,
            userName: e.user?.name ?? e.userName ?? uid.slice(0, 12),
            userEmail: e.user?.email ?? e.userEmail ?? '',
            enrollments: [],
            avgProgress: 0,
            lastActivity: null,
            complianceStatus: 'noData',
          });
        }
        const student = byUser.get(uid)!;
        const progress = typeof e.progress === 'string' ? parseFloat(e.progress) : (e.progress ?? 0);
        student.enrollments.push({
          id: e.id,
          courseId: e.course?.id ?? e.courseId,
          courseTitle: e.course?.title ?? 'Unknown',
          progress,
          status: e.status,
          enrolledAt: e.enrolledAt,
          completedAt: e.completedAt,
        });

        // Track most recent activity
        const actDate = e.lastActivityAt ?? e.updatedAt ?? e.enrolledAt;
        if (actDate && (!student.lastActivity || actDate > student.lastActivity)) {
          student.lastActivity = actDate;
        }
      }

      // Calculate averages and compliance
      for (const student of byUser.values()) {
        if (student.enrollments.length > 0) {
          const sum = student.enrollments.reduce((a, b) => a + b.progress, 0);
          student.avgProgress = sum / student.enrollments.length;

          const hasOverdue = student.enrollments.some(
            e => e.status === 'EXPIRED' || e.status === 'SUSPENDED'
          );
          student.complianceStatus = hasOverdue ? 'noncompliant' : 'compliant';
        }
      }

      setStudents(Array.from(byUser.values()));
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const toggleExpand = (userId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const filtered = students.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.userName.toLowerCase().includes(q) ||
      s.userEmail.toLowerCase().includes(q)
    );
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return t('admin.lms.progressTracking.neverActive');
    return new Date(dateStr).toLocaleDateString();
  };

  const complianceVariants: Record<string, 'success' | 'error' | 'neutral'> = {
    compliant: 'success',
    noncompliant: 'error',
    noData: 'neutral',
  };

  const columns: Column<StudentProgress>[] = [
    {
      key: 'expand',
      header: '',
      width: '36px',
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleExpand(row.userId); }}
          className="p-1 rounded hover:bg-slate-100 transition-colors"
          aria-label={t('admin.lms.progressTracking.courseProgress')}
        >
          {expandedIds.has(row.userId) ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>
      ),
    },
    {
      key: 'name',
      header: t('admin.lms.studentName'),
      render: (row) => (
        <div>
          <span className="font-medium text-slate-900">{row.userName}</span>
          <p className="text-xs text-slate-500 mt-0.5">{row.userEmail}</p>
        </div>
      ),
    },
    {
      key: 'enrolledCourses',
      header: t('admin.lms.progressTracking.enrolledCourses'),
      align: 'center',
      render: (row) => (
        <span className="text-sm tabular-nums">{row.enrollments.length}</span>
      ),
    },
    {
      key: 'avgProgress',
      header: t('admin.lms.progressTracking.avgProgress'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(row.avgProgress, 100)}%`,
                backgroundColor: row.avgProgress >= 80 ? '#16a34a' : row.avgProgress >= 40 ? '#d97706' : '#ef4444',
              }}
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums w-10">{row.avgProgress.toFixed(0)}%</span>
        </div>
      ),
    },
    {
      key: 'lastActivity',
      header: t('admin.lms.progressTracking.lastActivity'),
      render: (row) => (
        <span className="text-sm text-slate-600">{formatDate(row.lastActivity)}</span>
      ),
    },
    {
      key: 'compliance',
      header: t('admin.lms.progressTracking.complianceStatus'),
      render: (row) => (
        <StatusBadge variant={complianceVariants[row.complianceStatus] ?? 'neutral'}>
          {row.complianceStatus === 'compliant'
            ? t('admin.lms.progressTracking.compliant')
            : row.complianceStatus === 'noncompliant'
              ? t('admin.lms.progressTracking.nonCompliant')
              : t('admin.lms.progressTracking.noData')}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.progressTracking.title')}
        subtitle={`${filtered.length} ${t('admin.lms.progressTracking.total')}`}
        backHref="/admin/formation"
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('admin.lms.progressTracking.searchStudents')}
      />

      {!loading && filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('admin.lms.progressTracking.noProgressData')}
          description={t('admin.lms.progressTracking.noProgressDataDesc')}
        />
      ) : (
        <div className="space-y-0">
          <DataTable
            columns={columns}
            data={filtered}
            keyExtractor={(s) => s.userId}
            loading={loading}
            onRowClick={(row) => toggleExpand(row.userId)}
            emptyTitle={t('admin.lms.progressTracking.noProgressData')}
          />

          {/* Expanded rows - course progress details */}
          {filtered.map(student => (
            expandedIds.has(student.userId) && (
              <div
                key={`detail-${student.userId}`}
                className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg px-6 py-4 mb-2 -mt-1"
              >
                <h4 className="text-sm font-medium text-slate-700 mb-3">
                  {t('admin.lms.progressTracking.courseProgress')} — {student.userName}
                </h4>
                {student.enrollments.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('admin.lms.progressTracking.noEnrollments')}</p>
                ) : (
                  <div className="space-y-3">
                    {student.enrollments.map(enr => {
                      const pct = Math.min(enr.progress, 100);
                      return (
                        <div key={enr.id} className="flex items-center gap-4">
                          <span className="text-sm text-slate-700 w-48 truncate flex-shrink-0" title={enr.courseTitle}>
                            {enr.courseTitle}
                          </span>
                          <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: pct >= 100 ? '#16a34a' : pct >= 60 ? '#2563eb' : pct >= 30 ? '#d97706' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums w-12 text-right">{pct.toFixed(0)}%</span>
                          <StatusBadge
                            variant={
                              enr.status === 'COMPLETED' ? 'success'
                              : enr.status === 'ACTIVE' ? 'info'
                              : enr.status === 'EXPIRED' ? 'error'
                              : 'neutral'
                            }
                          >
                            {enr.status}
                          </StatusBadge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
