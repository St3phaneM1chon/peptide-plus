'use client';

import { Rows3, AlignJustify, Maximize2 } from 'lucide-react';
import { useAdminLayout, type DensityMode } from '@/lib/admin/admin-layout-context';
import { useI18n } from '@/i18n/client';

const MODES: { value: DensityMode; icon: typeof Rows3; labelKey: string }[] = [
  { value: 'compact', icon: AlignJustify, labelKey: 'admin.density.compact' },
  { value: 'standard', icon: Rows3, labelKey: 'admin.density.standard' },
  { value: 'focus', icon: Maximize2, labelKey: 'admin.density.focus' },
];

export default function DensityToggle() {
  const { density, setDensity } = useAdminLayout();
  const { t } = useI18n();

  const currentIndex = MODES.findIndex((m) => m.value === density);
  const next = MODES[(currentIndex + 1) % MODES.length];
  const CurrentIcon = MODES[currentIndex]?.icon ?? Rows3;

  return (
    <button
      onClick={() => setDensity(next.value)}
      className="p-2 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100
                 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700
                 transition-colors"
      aria-label={t('admin.density.toggle') || 'Toggle density'}
      title={t(`admin.density.${density}`) || density}
    >
      <CurrentIcon className="w-5 h-5" />
    </button>
  );
}
