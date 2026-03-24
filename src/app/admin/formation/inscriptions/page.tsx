'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import {
  PageHeader,
  Button,
  FormField,
  Input,
  DataTable,
  StatusBadge,
  EmptyState,
  Modal,
  type Column,
} from '@/components/admin';
import {
  Users,
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserPlus,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';

// --- Types ---

interface CourseOption {
  id: string;
  title: string;
  slug: string;
}

interface StudentOption {
  id: string;
  name: string | null;
  email: string;
}

interface CsvRow {
  email: string;
  courseSlug: string;
  deadline: string;
  valid: boolean;
  reason?: string;
}

interface BulkResult {
  enrolled: number;
  skipped: number;
  errors: { email: string; courseSlug: string; reason: string }[];
  total: number;
}

interface EnrollmentRow {
  id: string;
  userId: string;
  status: string;
  progress: number | string;
  enrolledAt: string;
  completedAt: string | null;
  course: { id: string; title: string; slug: string };
}

const statusVariants: Record<
  string,
  'success' | 'warning' | 'error' | 'neutral' | 'info'
> = {
  ACTIVE: 'info',
  COMPLETED: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'error',
  EXPIRED: 'neutral',
};

// --- Helper: CSV Template ---

function downloadCsvTemplate() {
  const template = 'email,courseSlug,deadline\njohn@example.com,cours-101,2026-06-30\njane@example.com,cours-201,';
  const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'enrollment-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

// --- Helper: Parse CSV ---

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  // Skip header
  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((p) => p.trim());
    const email = parts[0] ?? '';
    const courseSlug = parts[1] ?? '';
    const deadline = parts[2] ?? '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { email, courseSlug, deadline, valid: false, reason: 'invalid_email' };
    }
    if (!courseSlug) {
      return { email, courseSlug, deadline, valid: false, reason: 'missing_course' };
    }
    if (deadline) {
      const d = new Date(deadline);
      if (isNaN(d.getTime())) {
        return { email, courseSlug, deadline, valid: false, reason: 'invalid_date' };
      }
    }
    return { email, courseSlug, deadline, valid: true };
  });
}

// --- Component ---

export default function InscriptionsPage() {
  const { t } = useTranslations();

  // --- State: Tab ---
  const [activeTab, setActiveTab] = useState<'individual' | 'bulk'>('individual');

  // --- State: Individual enrollment ---
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- State: Bulk CSV ---
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- State: Current enrollments ---
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [enrollmentsTotal, setEnrollmentsTotal] = useState(0);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(true);
  const [enrollmentSearch, setEnrollmentSearch] = useState('');

  // --- State: Unenroll modal ---
  const [unenrollTarget, setUnenrollTarget] = useState<EnrollmentRow | null>(null);
  const [unenrolling, setUnenrolling] = useState(false);

  // --- Fetch courses ---
  useEffect(() => {
    fetch('/api/admin/lms/courses?limit=200')
      .then((res) => res.json())
      .then((data) => {
        const list = data.data?.courses ?? data.courses ?? [];
        setCourses(
          list.map((c: CourseOption) => ({
            id: c.id,
            title: c.title,
            slug: c.slug,
          }))
        );
      })
      .catch(() => {});
  }, []);

  // --- Fetch students (search) ---
  useEffect(() => {
    if (studentSearch.length < 2) {
      setStudents([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/admin/users?search=${encodeURIComponent(studentSearch)}&limit=20`)
        .then((res) => res.json())
        .then((data) => {
          const list = data.data?.users ?? data.users ?? [];
          setStudents(
            list.map((u: StudentOption) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            }))
          );
        })
        .catch(() => setStudents([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [studentSearch]);

  // --- Fetch enrollments ---
  const fetchEnrollments = useCallback(async () => {
    setEnrollmentsLoading(true);
    try {
      const res = await fetch('/api/admin/lms/enrollments?limit=50');
      const data = await res.json();
      const list = data.data?.enrollments ?? data.enrollments ?? [];
      setEnrollments(list);
      setEnrollmentsTotal(data.data?.total ?? data.total ?? 0);
    } catch {
      setEnrollments([]);
    } finally {
      setEnrollmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  // --- Individual enrollment ---
  const handleEnroll = async () => {
    if (!selectedStudent || !selectedCourse) return;
    setEnrolling(true);
    setEnrollMsg(null);

    try {
      const res = await fetch('/api/admin/lms/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse,
          userId: selectedStudent,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || t('admin.lms.enrollment.enrollError'));
      }

      setEnrollMsg({ type: 'success', text: t('admin.lms.enrollment.enrollSuccess') });
      setSelectedStudent('');
      setStudentSearch('');
      setDeadline('');
      fetchEnrollments();
      setTimeout(() => setEnrollMsg(null), 3000);
    } catch (err) {
      setEnrollMsg({
        type: 'error',
        text: err instanceof Error ? err.message : t('admin.lms.enrollment.enrollError'),
      });
    } finally {
      setEnrolling(false);
    }
  };

  // --- CSV file upload ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setEnrollMsg({ type: 'error', text: t('admin.lms.enrollment.invalidFileType') });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setEnrollMsg({ type: 'error', text: t('admin.lms.enrollment.noCsvData') });
        return;
      }
      setCsvRows(rows);
      setBulkResult(null);
    };
    reader.readAsText(file);
  };

  // --- Bulk import ---
  const handleBulkImport = async () => {
    const validRows = csvRows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    setBulkResult(null);

    try {
      const res = await fetch('/api/admin/lms/enrollments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            email: r.email,
            courseSlug: r.courseSlug,
            deadline: r.deadline || null,
          })),
        }),
      });

      const data = await res.json();
      const result = data.data ?? data;
      setBulkResult(result);
      fetchEnrollments();
    } catch {
      setEnrollMsg({ type: 'error', text: t('admin.lms.enrollment.enrollError') });
    } finally {
      setImporting(false);
    }
  };

  // --- Unenroll ---
  const handleUnenroll = async () => {
    if (!unenrollTarget) return;
    setUnenrolling(true);

    try {
      const res = await fetch('/api/admin/lms/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: unenrollTarget.course.id,
          userId: unenrollTarget.userId,
          action: 'cancel',
        }),
      });

      // Fallback: use DELETE-style via status update
      if (!res.ok) {
        // Try PATCH approach (update status to CANCELLED)
        await fetch(`/api/admin/lms/enrollments?id=${unenrollTarget.id}`, {
          method: 'DELETE',
        });
      }

      setUnenrollTarget(null);
      setEnrollMsg({ type: 'success', text: t('admin.lms.enrollment.unenrollSuccess') });
      fetchEnrollments();
      setTimeout(() => setEnrollMsg(null), 3000);
    } catch {
      setEnrollMsg({ type: 'error', text: t('admin.lms.enrollment.unenrollError') });
    } finally {
      setUnenrolling(false);
    }
  };

  // --- Helpers ---
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString();
  };

  const filteredEnrollments = enrollmentSearch
    ? enrollments.filter(
        (e) =>
          e.userId.toLowerCase().includes(enrollmentSearch.toLowerCase()) ||
          e.course.title.toLowerCase().includes(enrollmentSearch.toLowerCase())
      )
    : enrollments;

  const validRowCount = csvRows.filter((r) => r.valid).length;
  const invalidRowCount = csvRows.filter((r) => !r.valid).length;

  const reasonToText = (reason: string): string => {
    const map: Record<string, string> = {
      invalid_email: t('admin.lms.enrollment.errorInvalidEmail'),
      missing_course: t('admin.lms.enrollment.errorCourseNotFound'),
      invalid_date: t('admin.lms.enrollment.errorInvalidDate'),
      user_not_found: t('admin.lms.enrollment.errorUserNotFound'),
      course_not_found: t('admin.lms.enrollment.errorCourseNotFound'),
    };
    return map[reason] ?? reason;
  };

  // --- Columns ---
  const enrollmentColumns: Column<EnrollmentRow>[] = [
    {
      key: 'userId',
      header: t('admin.lms.studentName'),
      render: (row) => (
        <span className="text-sm font-medium text-slate-700">
          {row.userId.slice(0, 12)}...
        </span>
      ),
    },
    {
      key: 'course' as keyof EnrollmentRow,
      header: t('admin.lms.courseName'),
      render: (row) => (
        <span className="text-sm text-slate-600">{row.course.title}</span>
      ),
    },
    {
      key: 'status',
      header: t('admin.lms.enrollmentStatus.active'),
      render: (row) => (
        <StatusBadge variant={statusVariants[row.status] ?? 'neutral'}>
          {t(`admin.lms.enrollmentStatus.${row.status.toLowerCase()}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'progress',
      header: t('admin.lms.progress'),
      render: (row) => {
        const pct =
          typeof row.progress === 'number'
            ? row.progress
            : parseFloat(String(row.progress)) || 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{Math.round(pct)}%</span>
          </div>
        );
      },
    },
    {
      key: 'enrolledAt',
      header: t('admin.lms.enrolledAt'),
      render: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.enrolledAt)}</span>
      ),
    },
    {
      key: 'id',
      header: '',
      render: (row) => (
        <button
          onClick={() => setUnenrollTarget(row)}
          className="text-xs text-red-500 hover:text-red-700 transition-colors"
          title={t('admin.lms.enrollment.unenroll')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.enrollment.title')}
        subtitle={t('admin.lms.enrollment.subtitle')}
        backHref="/admin/formation"
      />

      {/* Global messages */}
      {enrollMsg && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            enrollMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {enrollMsg.text}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'individual'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          {t('admin.lms.enrollment.tabIndividual')}
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'bulk'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          {t('admin.lms.enrollment.tabBulk')}
        </button>
      </div>

      {/* Individual Enrollment */}
      {activeTab === 'individual' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-600" />
            {t('admin.lms.enrollment.individual')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Student search */}
            <FormField
              label={t('admin.lms.enrollment.selectStudent')}
              htmlFor="studentSearch"
            >
              <div className="relative">
                <Input
                  id="studentSearch"
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setSelectedStudent('');
                  }}
                  placeholder={t('admin.lms.enrollment.searchStudent')}
                />
                {students.length > 0 && !selectedStudent && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {students.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(s.id);
                          setStudentSearch(
                            s.name ? `${s.name} (${s.email})` : s.email
                          );
                          setStudents([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                      >
                        <span className="font-medium text-slate-700">
                          {s.name ?? s.email}
                        </span>
                        {s.name && (
                          <span className="text-slate-400 ml-1">
                            ({s.email})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FormField>

            {/* Course select */}
            <FormField
              label={t('admin.lms.enrollment.selectCourse')}
              htmlFor="courseSelect"
            >
              <select
                id="courseSelect"
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900
                  bg-white focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
              >
                <option value="">{t('admin.lms.enrollment.selectCourse')}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Deadline */}
            <FormField
              label={t('admin.lms.enrollment.deadline')}
              htmlFor="deadline"
              hint={t('admin.lms.enrollment.deadlineHint')}
            >
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </FormField>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleEnroll}
              disabled={enrolling || !selectedStudent || !selectedCourse}
            >
              {enrolling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {enrolling
                ? t('admin.lms.enrollment.enrolling')
                : t('admin.lms.enrollment.enroll')}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk CSV */}
      {activeTab === 'bulk' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              {t('admin.lms.enrollment.bulk')}
            </h3>
            <Button variant="ghost" onClick={downloadCsvTemplate}>
              <Download className="mr-2 h-4 w-4" />
              {t('admin.lms.enrollment.downloadTemplate')}
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            {t('admin.lms.enrollment.csvFormatHint')}
          </p>

          {/* File upload */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('admin.lms.enrollment.csvUpload')}
            </Button>
            {csvRows.length > 0 && (
              <span className="text-sm text-slate-600">
                {csvRows.length} {t('admin.lms.enrollment.rowsTotal')}
              </span>
            )}
          </div>

          {/* Preview table */}
          {csvRows.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  {validRowCount} {t('admin.lms.enrollment.rowsValid')}
                </span>
                {invalidRowCount > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle className="w-4 h-4" />
                    {invalidRowCount} {t('admin.lms.enrollment.rowsInvalid')}
                  </span>
                )}
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">
                        {t('admin.lms.enrollment.email')}
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">
                        {t('admin.lms.enrollment.courseSlug')}
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">
                        {t('admin.lms.enrollment.deadline')}
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">
                        {t('admin.lms.enrollment.validationStatus')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className={row.valid ? '' : 'bg-red-50/50'}
                      >
                        <td className="px-3 py-2 text-slate-700">
                          {row.email}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.courseSlug}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {row.deadline || '\u2014'}
                        </td>
                        <td className="px-3 py-2">
                          {row.valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('admin.lms.enrollment.valid')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                              <XCircle className="w-3 h-3" />
                              {reasonToText(row.reason ?? 'unknown')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onClick={handleBulkImport}
                  disabled={importing || validRowCount === 0}
                >
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {importing
                    ? t('admin.lms.enrollment.importing')
                    : t('admin.lms.enrollment.importNow')}
                </Button>
              </div>
            </>
          )}

          {/* Bulk result */}
          {bulkResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {t('admin.lms.enrollment.importResults')}
              </h4>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <span className="text-2xl font-bold text-emerald-700">
                    {bulkResult.enrolled}
                  </span>
                  <p className="text-xs text-emerald-600 mt-1">
                    {t('admin.lms.enrollment.enrolled')}
                  </p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-2xl font-bold text-amber-700">
                    {bulkResult.skipped}
                  </span>
                  <p className="text-xs text-amber-600 mt-1">
                    {t('admin.lms.enrollment.skipped')}
                  </p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
                  <span className="text-2xl font-bold text-red-700">
                    {bulkResult.errors.length}
                  </span>
                  <p className="text-xs text-red-600 mt-1">
                    {t('admin.lms.enrollment.errors')}
                  </p>
                </div>
              </div>

              {bulkResult.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-red-700">
                          {t('admin.lms.enrollment.email')}
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-red-700">
                          {t('admin.lms.enrollment.courseSlug')}
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-red-700">
                          {t('admin.lms.enrollment.reason')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {bulkResult.errors.map((err, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-slate-700">
                            {err.email}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {err.courseSlug}
                          </td>
                          <td className="px-3 py-2 text-red-600">
                            {reasonToText(err.reason)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Current Enrollments */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-indigo-50">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {t('admin.lms.enrollment.currentEnrollments')}
            </h3>
            <span className="text-xs text-slate-400">
              {enrollmentsTotal} {t('admin.lms.enrollmentsTotal')}
            </span>
          </div>
          <div className="w-56">
            <Input
              value={enrollmentSearch}
              onChange={(e) => setEnrollmentSearch(e.target.value)}
              placeholder={t('admin.lms.enrollment.searchEnrollments')}
            />
          </div>
        </div>

        {enrollmentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : filteredEnrollments.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('admin.lms.enrollment.noEnrollments')}
            description={t('admin.lms.enrollment.noEnrollmentsDesc')}
          />
        ) : (
          <DataTable data={filteredEnrollments} columns={enrollmentColumns} keyExtractor={(row) => row.id} />
        )}
      </div>

      {/* Unenroll confirmation modal */}
      {unenrollTarget && (
        <Modal
          isOpen={!!unenrollTarget}
          onClose={() => setUnenrollTarget(null)}
          title={t('admin.lms.enrollment.unenroll')}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                {t('admin.lms.enrollment.unenrollConfirm')}
              </p>
            </div>
            <p className="text-sm text-slate-600">
              <strong>{unenrollTarget.userId.slice(0, 12)}...</strong>
              {' \u2192 '}
              <strong>{unenrollTarget.course.title}</strong>
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setUnenrollTarget(null)}
              >
                {t('admin.lms.quiz.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleUnenroll}
                disabled={unenrolling}
              >
                {unenrolling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {t('admin.lms.enrollment.unenroll')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
