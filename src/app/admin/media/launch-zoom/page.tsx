'use client';

import { useCallback } from 'react';
import { PlatformLauncher } from '@/components/admin/PlatformLauncher';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';

export default function LaunchZoomPage() {
  const { t } = useI18n();

  // ---- Ribbon action handlers (media section-level: contextual for platform launcher) ----
  const handleUploadRibbon = useCallback(() => toast.info(t('admin.media.platformUploadHint') || 'File sharing is available within the Zoom meeting.'), [t]);
  const handleDeleteRibbon = useCallback(() => toast.info(t('admin.media.platformDeleteHint') || 'Meeting history can be managed in the Zoom app.'), [t]);
  const handlePlayRibbon = useCallback(() => toast.info(t('admin.media.platformPlayHint') || 'Recordings are available in the Zoom app after the meeting.'), [t]);
  const handleExportRibbon = useCallback(() => toast.info(t('admin.media.platformExportHint') || 'Export meeting data from within the Zoom app.'), [t]);

  useRibbonAction('upload', handleUploadRibbon);
  useRibbonAction('delete', handleDeleteRibbon);
  useRibbonAction('play', handlePlayRibbon);
  useRibbonAction('export', handleExportRibbon);

  return <PlatformLauncher platformId="zoom" />;
}
