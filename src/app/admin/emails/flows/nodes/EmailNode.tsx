'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { Mail } from 'lucide-react';
import { useI18n } from '@/i18n/client';

export default function EmailNode({ data }: NodeProps) {
  const { t } = useI18n();

  return (
    <div className="bg-sky-50 border-2 border-sky-300 rounded-lg p-3 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-sky-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-sky-200 flex items-center justify-center">
          <Mail className="h-4 w-4 text-sky-700" />
        </div>
        <div>
          <div className="text-[10px] font-medium text-sky-500 uppercase">{t('admin.emails.nodes.email')}</div>
          <div className="text-sm font-semibold text-sky-900">{data.label}</div>
        </div>
      </div>
      {data.subject && (
        <div className="mt-2 text-[10px] text-sky-600 truncate max-w-[160px]">
          {t('admin.emails.nodes.subject')}: {data.subject}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-sky-500 !w-3 !h-3" />
    </div>
  );
}
