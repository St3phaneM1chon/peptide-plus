'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from '@/hooks/useTranslations';
import { useState, useEffect, useCallback } from 'react';
import { PageHeader, Button, EmptyState, DataTable, type Column } from '@/components/admin';
import { BookOpen } from 'lucide-react';

export default function Page() {
  const { t } = useTranslations();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);




  const [courseId, setCourseId] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lms/gradebook?courseId=${courseId}`);
      const json = await res.json();
      const list = json.data?.grades ?? json.data?.statements ?? json.data ?? [];
      setData(Array.isArray(list) ? list : []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => { if (courseId) fetchData(); }, [fetchData]);

  const columns: Column<any>[] = [
    { key: 'etudiant', header: 'Etudiant', render: (row: any) => String(String(row.userId).slice(0,12) + '...') },
    { key: 'quiz_moy.', header: 'Quiz moy.', render: (row: any) => String(row.quizAverage != null ? row.quizAverage + '%' : '-') },
    { key: 'examen', header: 'Examen', render: (row: any) => String(row.examScore != null ? row.examScore + '%' : '-') },
    { key: 'note', header: 'Note', render: (row: any) => String(row.finalGrade != null ? row.finalGrade + '%' : '-') },
    { key: 'lettre', header: 'Lettre', render: (row: any) => String(row.letterGrade || '-') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Carnet de notes" subtitle=""

      />
      <div className="flex gap-2"><input type="text" placeholder="ID du cours" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-md border px-3 py-2 text-sm w-64" /><Button onClick={fetchData} variant="outline">{t('common.load')}</Button></div>
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={BookOpen} title={t('common.noData')} description={t('common.noData')} />
      ) : (
        <DataTable columns={columns} data={data} keyExtractor={(r: any) => r.id} />
      )}
    </div>
  );
}
