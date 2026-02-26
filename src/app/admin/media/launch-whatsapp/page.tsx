'use client';

import { useCallback } from 'react';
import { PlatformLauncher } from '@/components/admin/PlatformLauncher';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';

export default function LaunchWhatsAppPage() {
  const { t } = useI18n();

  const handleUploadRibbon = useCallback(() => toast.info(t('admin.media.platformUploadHint') || 'File sharing is available within WhatsApp.'), [t]);
  const handleDeleteRibbon = useCallback(() => toast.info(t('admin.media.platformDeleteHint') || 'Message history can be managed in WhatsApp.'), [t]);
  const handlePlayRibbon = useCallback(() => toast.info(t('admin.media.platformPlayHint') || 'Voice messages and media are available within WhatsApp.'), [t]);
  const handleExportRibbon = useCallback(() => toast.info(t('admin.media.platformExportHint') || 'Export chat data from within WhatsApp.'), [t]);

  useRibbonAction('upload', handleUploadRibbon);
  useRibbonAction('delete', handleDeleteRibbon);
  useRibbonAction('play', handlePlayRibbon);
  useRibbonAction('export', handleExportRibbon);

  return <PlatformLauncher platformId="whatsapp" />;
}
