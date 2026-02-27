'use client';

import { useCallback } from 'react';
import { PlatformLauncher } from '@/components/admin/PlatformLauncher';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';

export default function AdsTikTokPage() {
  const { t } = useI18n();

  useRibbonAction('newAdCampaign', useCallback(() => toast.info(t('admin.media.adCampaignHint') || 'Create ad campaigns in TikTok Ads Manager.'), [t]));
  useRibbonAction('performanceStats', useCallback(() => toast.info(t('admin.media.adStatsHint') || 'View analytics in TikTok Ads Manager.'), [t]));

  return <PlatformLauncher platformId="tiktok" />;
}
