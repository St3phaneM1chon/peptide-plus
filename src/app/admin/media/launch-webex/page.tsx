'use client';

import { useCallback } from 'react';
import { PlatformLauncher } from '@/components/admin/PlatformLauncher';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';

export default function LaunchWebexPage() {
  const { t } = useI18n();

  // ---- Ribbon action handlers (media section-level: upload, delete, play, export) ----
  const handleUploadRibbon = useCallback(() => toast.info(t('common.comingSoon')), [t]);
  const handleDeleteRibbon = useCallback(() => toast.info(t('common.comingSoon')), [t]);
  const handlePlayRibbon = useCallback(() => toast.info(t('common.comingSoon')), [t]);
  const handleExportRibbon = useCallback(() => toast.info(t('common.comingSoon')), [t]);

  useRibbonAction('upload', handleUploadRibbon);
  useRibbonAction('delete', handleDeleteRibbon);
  useRibbonAction('play', handlePlayRibbon);
  useRibbonAction('export', handleExportRibbon);

  return <PlatformLauncher platformId="webex" />;
}
