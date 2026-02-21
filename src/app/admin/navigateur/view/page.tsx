'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { WebNavigator } from '@/components/admin/WebNavigator';

interface PageData {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
}

export default function NavigateurViewPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const pageId = searchParams.get('pageId');
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pageId) { setLoading(false); setError(true); return; }
    fetch(`/api/admin/nav-pages/${pageId}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { setPageData(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [pageId]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  if (error || !pageData) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        {t('admin.webNavigator.pageNotFound')}
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)' }}>
      <WebNavigator
        url={pageData.url}
        title={pageData.title}
        subtitle={pageData.subtitle ?? undefined}
      />
    </div>
  );
}
