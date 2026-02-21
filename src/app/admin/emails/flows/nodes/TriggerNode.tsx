'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Zap } from 'lucide-react';
import { useI18n } from '@/i18n/client';

export default function TriggerNode({ data }: NodeProps) {
  const { t } = useI18n();

  return (
    <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-3 min-w-[180px] shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-purple-200 flex items-center justify-center">
          <Zap className="h-4 w-4 text-purple-700" />
        </div>
        <div>
          <div className="text-[10px] font-medium text-purple-500 uppercase">{t('admin.emails.nodes.trigger')}</div>
          <div className="text-sm font-semibold text-purple-900">{data.label}</div>
        </div>
      </div>
      {data.triggerEvent && (
        <div className="mt-2 text-[10px] text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
          {data.triggerEvent}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" />
    </div>
  );
}
