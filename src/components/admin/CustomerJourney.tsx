'use client';

import { ShoppingCart, Mail, Star, Gift, UserPlus, MessageSquare, Heart, TrendingUp } from 'lucide-react';

export interface JourneyEvent {
  id: string;
  type: 'signup' | 'order' | 'email_open' | 'review' | 'referral' | 'support' | 'wishlist' | 'loyalty';
  title: string;
  description?: string;
  timestamp: Date;
  value?: number;
}

const eventIcons: Record<string, { icon: React.ReactNode; bg: string }> = {
  signup: { icon: <UserPlus className="w-3.5 h-3.5" />, bg: 'bg-blue-100 text-blue-600' },
  order: { icon: <ShoppingCart className="w-3.5 h-3.5" />, bg: 'bg-green-100 text-green-600' },
  email_open: { icon: <Mail className="w-3.5 h-3.5" />, bg: 'bg-purple-100 text-purple-600' },
  review: { icon: <Star className="w-3.5 h-3.5" />, bg: 'bg-yellow-100 text-yellow-600' },
  referral: { icon: <Gift className="w-3.5 h-3.5" />, bg: 'bg-pink-100 text-pink-600' },
  support: { icon: <MessageSquare className="w-3.5 h-3.5" />, bg: 'bg-slate-100 text-slate-600' },
  wishlist: { icon: <Heart className="w-3.5 h-3.5" />, bg: 'bg-red-100 text-red-600' },
  loyalty: { icon: <TrendingUp className="w-3.5 h-3.5" />, bg: 'bg-emerald-100 text-emerald-600' },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function CustomerJourney({ events, compact = false }: { events: JourneyEvent[]; compact?: boolean }) {
  const sorted = [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Group by date
  const grouped = sorted.reduce<Record<string, JourneyEvent[]>>((acc, event) => {
    const dateKey = formatDate(event.timestamp);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  if (compact) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {sorted.slice(0, 10).map((event) => {
          const config = eventIcons[event.type] || eventIcons.signup;
          return (
            <div
              key={event.id}
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${config.bg}`}
              title={`${event.title} - ${formatDate(event.timestamp)}`}
            >
              {config.icon}
            </div>
          );
        })}
        {sorted.length > 10 && (
          <span className="text-xs text-slate-400 ps-1">+{sorted.length - 10}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, dayEvents]) => (
        <div key={date}>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{date}</h4>
          <div className="space-y-2">
            {dayEvents.map((event) => {
              const config = eventIcons[event.type] || eventIcons.signup;
              return (
                <div key={event.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-700">{event.title}</p>
                      {event.value !== undefined && (
                        <span className="text-xs font-semibold text-green-600">${event.value.toFixed(2)}</span>
                      )}
                    </div>
                    {event.description && <p className="text-xs text-slate-500">{event.description}</p>}
                    <p className="text-[10px] text-slate-400">{formatTime(event.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
