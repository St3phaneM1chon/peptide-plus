'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, Handshake, Phone, Mail, Award,
  Megaphone, MessageCircle, Calculator, Shield,
  Loader2, ChevronDown,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import type { TimelineEvent, BridgeModule } from '@/lib/bridges/types';

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ecommerce: ShoppingCart,
  crm: Handshake,
  voip: Phone,
  email: Mail,
  loyalty: Award,
  marketing: Megaphone,
  community: MessageCircle,
  accounting: Calculator,
  system: Shield,
};

const MODULE_COLORS: Record<string, string> = {
  ecommerce: 'bg-blue-100 text-blue-700 border-blue-200',
  crm: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  voip: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  email: 'bg-teal-100 text-teal-700 border-teal-200',
  loyalty: 'bg-purple-100 text-purple-700 border-purple-200',
  marketing: 'bg-orange-100 text-orange-700 border-orange-200',
  community: 'bg-pink-100 text-pink-700 border-pink-200',
  accounting: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  system: 'bg-slate-100 text-slate-700 border-slate-200',
};

interface UnifiedTimelineProps {
  userId: string;
  /** Max events to load per page */
  limit?: number;
  /** Modules to include (default: all) */
  modules?: BridgeModule[];
  /** Additional className */
  className?: string;
}

export function UnifiedTimeline({
  userId,
  limit = 30,
  modules,
  className = '',
}: UnifiedTimelineProps) {
  const { t } = useI18n();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filterModule, setFilterModule] = useState<BridgeModule | null>(null);

  const fetchEvents = useCallback(async (cursorParam?: string) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (modules) params.set('modules', modules.join(','));
    if (cursorParam) params.set('cursor', cursorParam);

    try {
      const res = await fetch(`/api/admin/timeline/${userId}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.data ?? json;
      return data as { events: TimelineEvent[]; total: number; cursor: string | null };
    } catch {
      return { events: [], total: 0, cursor: null };
    }
  }, [userId, limit, modules]);

  useEffect(() => {
    setLoading(true);
    fetchEvents().then((data) => {
      setEvents(data.events);
      setCursor(data.cursor);
      setHasMore(!!data.cursor);
      setLoading(false);
    });
  }, [fetchEvents]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchEvents(cursor);
    setEvents((prev) => [...prev, ...data.events]);
    setCursor(data.cursor);
    setHasMore(!!data.cursor);
    setLoadingMore(false);
  };

  const filteredEvents = filterModule
    ? events.filter((e) => e.module === filterModule)
    : events;

  // Group events by date
  const grouped: Record<string, TimelineEvent[]> = {};
  for (const event of filteredEvents) {
    const dateKey = new Date(event.timestamp).toLocaleDateString('fr-CA');
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(event);
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Module filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setFilterModule(null)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            !filterModule ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          {t('admin.bridges.viewAll')}
        </button>
        {Object.keys(MODULE_COLORS).map((mod) => {
          const hasEvents = events.some((e) => e.module === mod);
          if (!hasEvents) return null;
          const Icon = MODULE_ICONS[mod];
          return (
            <button
              key={mod}
              onClick={() => setFilterModule(mod as BridgeModule)}
              className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 transition-colors ${
                filterModule === mod
                  ? MODULE_COLORS[mod]
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {mod}
            </button>
          );
        })}
      </div>

      {filteredEvents.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-4">{t('admin.bridges.noData')}</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayEvents]) => (
            <div key={date}>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                {date}
              </div>
              <div className="space-y-1">
                {dayEvents.map((event) => {
                  const Icon = MODULE_ICONS[event.module] || Shield;
                  const colorClass = MODULE_COLORS[event.module] || MODULE_COLORS.system;
                  const time = new Date(event.timestamp).toLocaleTimeString('fr-CA', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  const content = (
                    <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-800 truncate">{event.title}</p>
                          <span className="text-xs text-slate-400 flex-shrink-0 ms-2">{time}</span>
                        </div>
                        {event.description && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{event.description}</p>
                        )}
                      </div>
                    </div>
                  );

                  return event.link ? (
                    <Link key={event.id} href={event.link} className="block">
                      {content}
                    </Link>
                  ) : (
                    <div key={event.id}>{content}</div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1 px-4 py-2 rounded-lg hover:bg-teal-50 transition-colors"
          >
            {loadingMore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {t('admin.bridges.viewAll')}
          </button>
        </div>
      )}
    </div>
  );
}
