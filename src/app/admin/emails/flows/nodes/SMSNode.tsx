'use client';

import { Handle, Position, type NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';

export default function SMSNode({ data }: NodeProps) {
  return (
    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 min-w-[180px] shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-green-200 flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-green-700" />
        </div>
        <div>
          <div className="text-[10px] font-medium text-green-500 uppercase">SMS</div>
          <div className="text-sm font-semibold text-green-900">{data.label}</div>
        </div>
      </div>
      {data.smsMessage && (
        <div className="mt-2 text-[10px] text-green-600 truncate max-w-[160px]">
          {data.smsMessage}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}
