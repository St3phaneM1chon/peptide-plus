'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, StatCard, SectionCard, Button } from '@/components/admin';
import { BookOpen, Users, Award, AlertTriangle, BarChart3, Plus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface LmsStats {
  totalCourses: number;
  publishedCourses: number;
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  completionRate: number;
  totalCertificates: number;
  overdueCompliance: number;
}

export default function LmsDashboardPage() {
  const { t } = useTranslations();
  const [stats, setStats] = useState<LmsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/admin/lms/analytics')
      .then(res => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then(data => {
        setStats(data.data ?? data);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive font-medium mb-2">Impossible de charger les statistiques</p>
        <button onClick={() => window.location.reload()} className="text-sm text-primary hover:underline">Reessayer</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.dashboard')}
        subtitle={t('admin.lms.dashboardSubtitle')}
        actions={
          <Link href="/admin/formation/cours/nouveau">
            <Button><Plus className="mr-2 h-4 w-4" />{t('admin.lms.newCourse')}</Button>
          </Link>
        }
      />

      {/* Compliance Alert */}
      {stats && stats.overdueCompliance > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="font-medium text-red-800">
              {stats.overdueCompliance} {t('admin.lms.overdueComplianceAlert')}
            </p>
            <Link href="/admin/formation/conformite" className="text-sm text-red-600 underline">
              {t('admin.lms.viewDetails')}
            </Link>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('admin.lms.totalCourses')}
          value={loading ? '—' : stats?.totalCourses ?? 0}
          icon={BookOpen}
        />
        <StatCard
          label={t('admin.lms.activeStudents')}
          value={loading ? '—' : stats?.activeEnrollments ?? 0}
          icon={Users}
        />
        <StatCard
          label={t('admin.lms.completionRate')}
          value={loading ? '—' : `${stats?.completionRate ?? 0}%`}
          icon={BarChart3}
        />
        <StatCard
          label={t('admin.lms.certificates')}
          value={loading ? '—' : stats?.totalCertificates ?? 0}
          icon={Award}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/formation/cours">
          <SectionCard title={t('admin.lms.manageCourses')} className="cursor-pointer transition-colors hover:bg-accent/50">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <p className="text-sm text-muted-foreground">{t('admin.lms.manageCoursesDesc')}</p>
            </div>
          </SectionCard>
        </Link>
        <Link href="/admin/formation/etudiants">
          <SectionCard title={t('admin.lms.manageStudents')} className="cursor-pointer transition-colors hover:bg-accent/50">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-green-600" />
              <p className="text-sm text-muted-foreground">{t('admin.lms.manageStudentsDesc')}</p>
            </div>
          </SectionCard>
        </Link>
        <Link href="/admin/formation/conformite">
          <SectionCard title={t('admin.lms.compliance')} className="cursor-pointer transition-colors hover:bg-accent/50">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              <p className="text-sm text-muted-foreground">{t('admin.lms.complianceDesc')}</p>
            </div>
          </SectionCard>
        </Link>
      </div>
    </div>
  );
}
