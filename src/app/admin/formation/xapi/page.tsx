'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useTranslations } from '@/hooks/useTranslations';
import { useState, useEffect, useCallback } from 'react';
import { PageHeader, EmptyState, DataTable, type Column } from '@/components/admin';
import { Activity } from 'lucide-react';

export default function Page() {
  const { t } = useTranslations();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);






  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lms/xapi`);
      const json = await res.json();
      const list = json.data?.grades ?? json.data?.statements ?? json.data ?? [];
      setData(Array.isArray(list) ? list : []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns: Column<any>[] = [
    { key: 'action', header: 'Action', render: (row: any) => String(row.verb) },
    { key: 'type', header: 'Type', render: (row: any) => String(row.objectType) },
    { key: 'objet', header: 'Objet', render: (row: any) => String(row.objectName || row.objectId) },
    { key: 'date', header: 'Date', render: (row: any) => String(new Date(row.timestamp).toLocaleString('fr-CA')) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="xAPI / Learning Records" subtitle=""

      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={Activity} title={t('common.noData')} description={t('common.noData')} />
      ) : (
        <DataTable columns={columns} data={data} keyExtractor={(r: any) => r.id} />
      )}
    </div>
  );
}
