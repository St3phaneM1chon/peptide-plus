'use client';

import { useCallback } from 'react';
import { PlatformLauncher } from '@/components/admin/PlatformLauncher';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';

export default function LaunchTeamsPage() {
  const { t } = useI18n();

  // ---- Ribbon action handlers (media section-level: contextual for platform launcher) ----
  const handleUploadRibbon = useCallback(() => toast.info(t('admin.media.platformUploadHint')), [t]);
  const handleDeleteRibbon = useCallback(() => toast.info(t('admin.media.platformDeleteHint')), [t]);
  const handlePlayRibbon = useCallback(() => toast.info(t('admin.media.platformPlayHint')), [t]);
  const handleExportRibbon = useCallback(() => toast.info(t('admin.media.platformExportHint')), [t]);

  useRibbonAction('upload', handleUploadRibbon);
  useRibbonAction('delete', handleDeleteRibbon);
  useRibbonAction('play', handlePlayRibbon);
  useRibbonAction('export', handleExportRibbon);

  return <PlatformLauncher platformId="teams" />;
}
