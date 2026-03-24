'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, StatCard, SectionCard, Button } from '@/components/admin';
import {
  BookOpen,
  Users,
  Award,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Download,
  CheckCircle,
  XCircle,
  UserPlus,
  Activity,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────

interface AnalyticsStats {
  totalCourses: number;
  totalEnrollments: number;
  avgCompletionRate: number;
  activeStudentsMonth: number;
  certificatesIssued: number;
  atRiskStudents: number;
}

interface MonthlyEnrollment {
  month: string;
  count: number;
}

interface CourseCompletion {
  courseId: string;
  title: string;
  enrollments: number;
  completions: number;
  rate: number;
}

interface TopCourse {
  rank: number;
  title: string;
  enrollments: number;
}

interface QuizPassRate {
  quizId: string;
  title: string;
  attempts: number;
  passed: number;
  rate: number;
}

interface AtRiskStudent {
  studentId: string;
  studentName: string;
  courseTitle: string;
  progress: number;
  deadline: string;
  timeElapsedPct: number;
  enrolledAt: string;
}

interface ActivityEvent {
  type: 'enrollment' | 'completion' | 'certificate' | 'quiz_pass' | 'quiz_fail';
  studentName: string;
  detail: string;
  date: string;
}

interface AnalyticsData {
  stats: AnalyticsStats;
  monthlyEnrollments: MonthlyEnrollment[];
  completionByCourse: CourseCompletion[];
  topCourses: TopCourse[];
  quizPassRates: QuizPassRate[];
  atRiskList: AtRiskStudent[];
  recentActivity: ActivityEvent[];
}

type DateRange = 'month' | '3months' | 'year' | 'all';

// ── Skeleton Components ─────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-slate-200 rounded w-24" />
          <div className="h-7 bg-slate-200 rounded w-16 mt-1" />
        </div>
        <div className="h-9 w-9 bg-slate-200 rounded-lg" />
      </div>
    </div>
  );
}

function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`animate-pulse ${height}`}>
      <div className="flex items-end gap-2 h-full pb-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-200 rounded-t"
            style={{ height: `${20 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-8 bg-slate-100 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-50 rounded" />
      ))}
    </div>
  );
}

// ── Chart Data Item ──────────────────────────────────────────────

interface ChartItem {
  label: string;
  value: number;
}

// ── Horizontal Bar Chart ────────────────────────────────────────

function HorizontalBarChart({
  items,
  maxValue,
  color = '#3b82f6',
  unit = '',
}: {
  items: ChartItem[];
  maxValue: number;
  color?: string;
  unit?: string;
}) {
  if (items.length === 0) return null;
  const barHeight = 28;
  const gap = 6;
  const labelWidth = 60;
  const valueWidth = 50;

  return (
    <div className="w-full">
      {items.map((item, i) => {
        const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div
            key={i}
            className="flex items-center gap-2 group"
            style={{ height: barHeight + gap }}
          >
            <span
              className="text-xs text-slate-500 truncate text-right shrink-0"
              style={{ width: labelWidth }}
              title={item.label}
            >
              {item.label}
            </span>
            <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden relative">
              <div
                className="h-full rounded transition-all duration-500 ease-out"
                style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }}
              />
            </div>
            <span
              className="text-xs font-medium text-slate-700 tabular-nums shrink-0"
              style={{ width: valueWidth }}
            >
              {item.value}{unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Vertical Bar Chart ──────────────────────────────────────────

function VerticalBarChart({
  items,
  color = '#3b82f6',
  unit = '',
}: {
  items: ChartItem[];
  color?: string;
  unit?: string;
}) {
  if (items.length === 0) return null;
  const maxVal = Math.max(...items.map(d => d.value), 1);

  return (
    <div className="flex items-end gap-1 h-48 px-1">
      {items.map((item, i) => {
        const pct = (item.value / maxVal) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] text-slate-500 tabular-nums">
              {item.value}{unit}
            </span>
            <div className="w-full bg-slate-100 rounded-t relative" style={{ height: '140px' }}>
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t transition-all duration-500 ease-out"
                style={{
                  height: `${Math.max(pct, 2)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-400 truncate w-full text-center" title={item.label}>
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity Event Row ──────────────────────────────────────────

function ActivityEventRow({ event, t }: { event: ActivityEvent; t: (k: string) => string }) {
  const iconMap = {
    enrollment: { icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50' },
    completion: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    certificate: { icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
    quiz_pass: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    quiz_fail: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  };

  const labelMap: Record<string, string> = {
    enrollment: t('admin.lms.analytics.eventEnrollment'),
    completion: t('admin.lms.analytics.eventCompletion'),
    certificate: t('admin.lms.analytics.eventCertificate'),
    quiz_pass: t('admin.lms.analytics.eventQuizPass'),
    quiz_fail: t('admin.lms.analytics.eventQuizFail'),
  };

  const config = iconMap[event.type];
  const Icon = config.icon;
  const dateStr = new Date(event.date).toLocaleDateString('fr-CA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-b-0">
      <div className={`p-1.5 rounded-lg ${config.bg} shrink-0`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 truncate">
          <span className="font-medium">{event.studentName}</span>
          <span className="text-slate-400 mx-1.5">&middot;</span>
          <span className="text-slate-500">{labelMap[event.type]}</span>
        </p>
        <p className="text-xs text-slate-400 truncate">{event.detail}</p>
      </div>
      <span className="text-xs text-slate-400 shrink-0 tabular-nums">{dateStr}</span>
    </div>
  );
}

// ── CSV Export ───────────────────────────────────────────────────

function exportAnalyticsCsv(data: AnalyticsData, t: (k: string) => string) {
  const lines: string[] = [];

  // Header section
  lines.push('=== ' + t('admin.lms.analytics.title') + ' ===');
  lines.push('');

  // Stats
  lines.push(t('admin.lms.analytics.totalCourses') + ',' + data.stats.totalCourses);
  lines.push(t('admin.lms.analytics.totalEnrollments') + ',' + data.stats.totalEnrollments);
  lines.push(t('admin.lms.analytics.avgCompletionRate') + ',' + data.stats.avgCompletionRate + '%');
  lines.push(t('admin.lms.analytics.activeStudentsMonth') + ',' + data.stats.activeStudentsMonth);
  lines.push(t('admin.lms.analytics.certificatesIssued') + ',' + data.stats.certificatesIssued);
  lines.push(t('admin.lms.analytics.atRiskStudents') + ',' + data.stats.atRiskStudents);
  lines.push('');

  // Monthly enrollments
  lines.push('=== ' + t('admin.lms.analytics.enrollmentTrend') + ' ===');
  lines.push(t('admin.lms.analytics.dateRange') + ',' + t('admin.lms.analytics.enrollments'));
  data.monthlyEnrollments.forEach(m => {
    lines.push(m.month + ',' + m.count);
  });
  lines.push('');

  // Completion by course
  lines.push('=== ' + t('admin.lms.analytics.completionByCourse') + ' ===');
  lines.push(t('admin.lms.analytics.courseName') + ',' + t('admin.lms.analytics.enrollments') + ',' + t('admin.lms.analytics.completionRate'));
  data.completionByCourse.forEach(c => {
    lines.push('"' + c.title.replace(/"/g, '""') + '",' + c.enrollments + ',' + c.rate + '%');
  });
  lines.push('');

  // Quiz pass rates
  lines.push('=== ' + t('admin.lms.analytics.quizPassRate') + ' ===');
  lines.push(t('admin.lms.analytics.courseName') + ',' + t('admin.lms.analytics.count') + ',' + t('admin.lms.analytics.passRate'));
  data.quizPassRates.forEach(q => {
    lines.push('"' + q.title.replace(/"/g, '""') + '",' + q.attempts + ',' + q.rate + '%');
  });
  lines.push('');

  // At-risk students
  if (data.atRiskList.length > 0) {
    lines.push('=== ' + t('admin.lms.analytics.atRiskTable') + ' ===');
    lines.push(
      t('admin.lms.analytics.student') + ',' +
      t('admin.lms.analytics.course') + ',' +
      t('admin.lms.analytics.progress') + ',' +
      t('admin.lms.analytics.deadline') + ',' +
      t('admin.lms.analytics.timeElapsed')
    );
    data.atRiskList.forEach(s => {
      lines.push(
        '"' + s.studentName.replace(/"/g, '""') + '",' +
        '"' + s.courseTitle.replace(/"/g, '""') + '",' +
        s.progress + '%,' +
        new Date(s.deadline).toLocaleDateString('fr-CA') + ',' +
        s.timeElapsedPct + '%'
      );
    });
  }

  const csvContent = '\uFEFF' + lines.join('\n'); // BOM for Excel
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lms-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Main Page ───────────────────────────────────────────────────

export default function LmsAnalyticsPage() {
  const { t } = useTranslations();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [exportSuccess, setExportSuccess] = useState(false);

  const fetchData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lms/analytics/detailed?range=${range}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data ?? json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange);
  }, [dateRange, fetchData]);

  const handleExport = useCallback(() => {
    if (!data) return;
    exportAnalyticsCsv(data, t);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  }, [data, t]);

  const dateRangeOptions: { value: DateRange; label: string }[] = useMemo(() => [
    { value: 'month', label: t('admin.lms.analytics.thisMonth') },
    { value: '3months', label: t('admin.lms.analytics.last3Months') },
    { value: 'year', label: t('admin.lms.analytics.lastYear') },
    { value: 'all', label: t('admin.lms.analytics.allTime') },
  ], [t]);

  // ── Error state ──────────────────────────────────────────────
  if (error && !loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('admin.lms.analytics.title')}
          subtitle={t('admin.lms.analytics.subtitle')}
          backHref="/admin/formation"
          backLabel={t('admin.lms.dashboard')}
        />
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-white rounded-xl border border-slate-200 p-8">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {t('admin.lms.analytics.error')}
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md">
            {t('admin.lms.analytics.errorDescription')}
          </p>
          <Button onClick={() => fetchData(dateRange)}>
            {t('admin.lms.analytics.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('admin.lms.analytics.title')}
        subtitle={t('admin.lms.analytics.subtitle')}
        backHref="/admin/formation"
        backLabel={t('admin.lms.dashboard')}
        actions={
          <div className="flex items-center gap-3">
            {/* Date Range Filter */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label={t('admin.lms.analytics.dateRange')}
            >
              {dateRangeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Export CSV */}
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || !data}
            >
              <Download className="mr-2 h-4 w-4" />
              {exportSuccess ? t('admin.lms.analytics.exportSuccess') : t('admin.lms.analytics.exportCsv')}
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : data ? (
          <>
            <StatCard
              label={t('admin.lms.analytics.totalCourses')}
              value={data.stats.totalCourses}
              icon={BookOpen}
            />
            <StatCard
              label={t('admin.lms.analytics.totalEnrollments')}
              value={data.stats.totalEnrollments}
              icon={Users}
            />
            <StatCard
              label={t('admin.lms.analytics.avgCompletionRate')}
              value={`${data.stats.avgCompletionRate}%`}
              icon={BarChart3}
            />
            <StatCard
              label={t('admin.lms.analytics.activeStudentsMonth')}
              value={data.stats.activeStudentsMonth}
              icon={TrendingUp}
            />
            <StatCard
              label={t('admin.lms.analytics.certificatesIssued')}
              value={data.stats.certificatesIssued}
              icon={Award}
            />
            <StatCard
              label={t('admin.lms.analytics.atRiskStudents')}
              value={data.stats.atRiskStudents}
              icon={AlertTriangle}
            />
          </>
        ) : null}
      </div>

      {/* Charts Row 1: Enrollment Trend + Completion by Course */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enrollment Trend */}
        <SectionCard
          title={t('admin.lms.analytics.enrollmentTrend')}
          headerAction={
            <span className="text-xs text-slate-400">{t('admin.lms.analytics.last12Months')}</span>
          }
        >
          {loading ? (
            <ChartSkeleton />
          ) : data && data.monthlyEnrollments.length > 0 ? (
            <VerticalBarChart
              items={data.monthlyEnrollments.map(m => ({ label: m.month, value: m.count }))}
              color="#3b82f6"
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-400">
              {t('admin.lms.analytics.noRecentActivity')}
            </div>
          )}
        </SectionCard>

        {/* Completion Rate by Course */}
        <SectionCard title={t('admin.lms.analytics.completionByCourse')}>
          {loading ? (
            <ChartSkeleton />
          ) : data && data.completionByCourse.length > 0 ? (
            <HorizontalBarChart
              items={data.completionByCourse.map(c => ({ label: c.title, value: c.rate }))}
              maxValue={100}
              color="#10b981"
              unit="%"
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-400">
              {t('admin.lms.analytics.noRecentActivity')}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Charts Row 2: Top Courses + Quiz Pass Rates */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 5 Courses */}
        <SectionCard title={t('admin.lms.analytics.topCoursesByEnrollment')}>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : data && data.topCourses.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.topCourses.map((course) => (
                <div key={course.rank} className="flex items-center gap-4 py-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold shrink-0">
                    {course.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{course.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 tabular-nums">
                      {course.enrollments}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-400">
              {t('admin.lms.analytics.noRecentActivity')}
            </div>
          )}
        </SectionCard>

        {/* Quiz Pass Rate */}
        <SectionCard title={t('admin.lms.analytics.quizPassRate')}>
          {loading ? (
            <ChartSkeleton />
          ) : data && data.quizPassRates.length > 0 ? (
            <HorizontalBarChart
              items={data.quizPassRates.map(q => ({ label: q.title, value: q.rate }))}
              maxValue={100}
              color="#8b5cf6"
              unit="%"
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-400">
              {t('admin.lms.analytics.noRecentActivity')}
            </div>
          )}
        </SectionCard>
      </div>

      {/* At-Risk Students Table */}
      <SectionCard
        title={t('admin.lms.analytics.atRiskTable')}
        headerAction={
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-slate-400">{t('admin.lms.analytics.atRiskDescription')}</span>
          </div>
        }
      >
        {loading ? (
          <TableSkeleton rows={5} />
        ) : data && data.atRiskList.length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left font-medium text-slate-500 px-6 py-3">
                    {t('admin.lms.analytics.student')}
                  </th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">
                    {t('admin.lms.analytics.course')}
                  </th>
                  <th className="text-center font-medium text-slate-500 px-4 py-3">
                    {t('admin.lms.analytics.progress')}
                  </th>
                  <th className="text-center font-medium text-slate-500 px-4 py-3">
                    {t('admin.lms.analytics.timeElapsed')}
                  </th>
                  <th className="text-left font-medium text-slate-500 px-4 py-3">
                    {t('admin.lms.analytics.deadline')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.atRiskList.map((student, i) => (
                  <tr
                    key={`${student.studentId}-${student.courseTitle}-${i}`}
                    className="border-b border-slate-50 hover:bg-slate-25 transition-colors"
                  >
                    <td className="px-6 py-3 font-medium text-slate-800">
                      {student.studentName}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                      {student.courseTitle}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full transition-all"
                            style={{ width: `${student.progress}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-red-600 font-medium">
                          {student.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${student.timeElapsedPct}%`,
                              backgroundColor: student.timeElapsedPct > 80 ? '#ef4444' : student.timeElapsedPct > 60 ? '#f59e0b' : '#3b82f6',
                            }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-slate-600">
                          {student.timeElapsedPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs tabular-nums">
                      {new Date(student.deadline).toLocaleDateString('fr-CA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <CheckCircle className="h-10 w-10 mb-3 text-emerald-400" />
            <p className="text-sm">{t('admin.lms.analytics.noAtRiskStudents')}</p>
          </div>
        )}
      </SectionCard>

      {/* Recent Activity Feed */}
      <SectionCard
        title={t('admin.lms.analytics.recentActivity')}
        headerAction={
          <span className="text-xs text-slate-400">{t('admin.lms.analytics.recentActivityDesc')}</span>
        }
      >
        {loading ? (
          <TableSkeleton rows={8} />
        ) : data && data.recentActivity.length > 0 ? (
          <div className="max-h-[480px] overflow-y-auto -mx-2 px-2">
            {data.recentActivity.map((event, i) => (
              <ActivityEventRow key={`${event.type}-${event.date}-${i}`} event={event} t={t} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Activity className="h-10 w-10 mb-3" />
            <p className="text-sm">{t('admin.lms.analytics.noRecentActivity')}</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
