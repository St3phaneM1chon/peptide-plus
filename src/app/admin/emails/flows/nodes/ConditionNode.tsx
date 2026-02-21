'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { GitMerge } from 'lucide-react';
import { useI18n } from '@/i18n/client';

export default function ConditionNode({ data }: NodeProps) {
  const { t } = useI18n();

  return (
    <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-3 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center">
          <GitMerge className="h-4 w-4 text-orange-700" />
        </div>
        <div>
          <div className="text-[10px] font-medium text-orange-500 uppercase">{t('admin.emails.nodes.condition')}</div>
          <div className="text-sm font-semibold text-orange-900">{data.label}</div>
        </div>
      </div>
      {data.conditionField && (
        <div className="mt-2 text-[10px] text-orange-600">
          {data.conditionField} {data.conditionOperator} {data.conditionValue}
        </div>
      )}
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-green-600 font-medium">{t('admin.emails.nodes.yes')}</span>
        <span className="text-[10px] text-red-600 font-medium">{t('admin.emails.nodes.no')}</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" className="!bg-green-500 !w-3 !h-3 !left-[30%]" />
      <Handle type="source" position={Position.Bottom} id="false" className="!bg-red-500 !w-3 !h-3 !left-[70%]" />
    </div>
  );
}
