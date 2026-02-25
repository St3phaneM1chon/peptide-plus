'use client';

import { Package, CreditCard, Truck, CheckCircle, XCircle, RotateCcw, Clock, FileText, MessageSquare } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  type: 'created' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'note' | 'return';
  title: string;
  description?: string;
  user?: string;
  timestamp: Date;
  metadata?: Record<string, string>;
}

const typeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  created: { icon: <FileText className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-100' },
  paid: { icon: <CreditCard className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-100' },
  processing: { icon: <Clock className="w-4 h-4" />, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  shipped: { icon: <Truck className="w-4 h-4" />, color: 'text-purple-600', bg: 'bg-purple-100' },
  delivered: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-100' },
  cancelled: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-600', bg: 'bg-red-100' },
  refunded: { icon: <RotateCcw className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-100' },
  note: { icon: <MessageSquare className="w-4 h-4" />, color: 'text-slate-600', bg: 'bg-slate-100' },
  return: { icon: <Package className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-100' },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="relative">
      <div className="absolute start-5 top-0 bottom-0 w-0.5 bg-slate-200" />
      <div className="space-y-4">
        {sorted.map((event) => {
          const config = typeConfig[event.type] || typeConfig.note;
          return (
            <div key={event.id} className="relative flex gap-4 items-start">
              <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full ${config.bg} ${config.color} ring-4 ring-white`}>
                {config.icon}
              </div>
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-slate-800">{event.title}</p>
                  <span className="text-xs text-slate-400">{formatDate(event.timestamp)}</span>
                </div>
                {event.description && <p className="text-sm text-slate-500 mt-0.5">{event.description}</p>}
                {event.user && <p className="text-xs text-slate-400 mt-1">Par {event.user}</p>}
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(event.metadata).map(([k, v]) => (
                      <span key={k} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
