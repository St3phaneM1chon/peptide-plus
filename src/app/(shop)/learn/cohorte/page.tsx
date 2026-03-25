'use client';

import { Users } from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

export default function CohortePage() {
  const { t } = useTranslations();
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
        <Users className="h-8 w-8 text-indigo-500" /> {t('lms.cohort.title')}
      </h1>
      <p className="text-muted-foreground mb-8">{t('lms.cohort.subtitle')}</p>

      <div className="text-center py-12 rounded-xl border">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">{t('lms.cohort.noCohort')}</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {t('lms.cohort.noCohortDescription')}
        </p>
      </div>
    </div>
  );
}
