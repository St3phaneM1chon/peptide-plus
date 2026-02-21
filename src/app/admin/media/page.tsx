'use client';

import { useI18n } from '@/i18n/client';

export default function MediaDashboardPage() {
  const { t } = useI18n();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">{t('admin.media.dashboardTitle')}</h1>
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-500">{t('admin.media.comingSoon')}</p>
      </div>
    </div>
  );
}
