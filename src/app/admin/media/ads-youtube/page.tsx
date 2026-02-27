'use client';

import { useCallback } from 'react';
import { PlatformLauncher } from '@/components/admin/PlatformLauncher';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';

export default function AdsYouTubePage() {
  const { t } = useI18n();

  useRibbonAction('newAdCampaign', useCallback(() => toast.info(t('admin.media.adCampaignHint') || 'Create ad campaigns in YouTube Studio.'), [t]));
  useRibbonAction('performanceStats', useCallback(() => toast.info(t('admin.media.adStatsHint') || 'View analytics in YouTube Studio.'), [t]));

  return <PlatformLauncher platformId="youtube" />;
}
