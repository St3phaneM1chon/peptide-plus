'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Clock } from 'lucide-react';
import { useI18n } from '@/i18n/client';

export default function DelayNode({ data }: NodeProps) {
  const { t } = useI18n();

  const unitLabels: Record<string, string> = {
    minutes: t('admin.emails.nodes.unitMin'),
    hours: t('admin.emails.nodes.unitHour'),
    days: t('admin.emails.nodes.unitDay'),
    weeks: t('admin.emails.nodes.unitWeek'),
  };

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 min-w-[150px] shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center">
          <Clock className="h-4 w-4 text-amber-700" />
        </div>
        <div>
          <div className="text-[10px] font-medium text-amber-500 uppercase">{t('admin.emails.nodes.delay')}</div>
          <div className="text-sm font-semibold text-amber-900">
            {data.delayAmount || 1} {unitLabels[data.delayUnit] || data.delayUnit || t('admin.emails.nodes.unitDay')}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3" />
    </div>
  );
}
