'use client';

import { useI18n } from '@/i18n/client';

export default function SkipToContent() {
  const { t } = useI18n();

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-orange-500 focus:text-white focus:rounded-lg focus:font-semibold focus:text-sm"
    >
      {t('common.aria.skipToContent')}
    </a>
  );
}
