'use client';

/**
 * ActivityTimelineWidget — Unified cross-module timeline for an entity.
 *
 * A compact, embeddable version of the full UnifiedTimeline component.
 * Shows recent cross-module activity (orders, emails, calls, loyalty, etc.)
 * for a given user/entity. Designed to sit inside admin detail cards.
 *
 * Uses the /api/admin/timeline/[userId] API with cursor-based pagination.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingCart, Handshake, Phone, Mail, Award,
  Megaphone, MessageCircle, Calculator, Shield,
  Loader2, Clock, ChevronDown,
} from 'lucide-react';
import type { BridgeModule } from '@/lib/bridges/types';

// ---------------------------------------------------------------------------
// Module visual mappings (shared with UnifiedTimeline)
// ---------------------------------------------------------------------------

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
  ecommerce: 'bg-blue-100 text-blue-700',
  crm: 'bg-cyan-100 text-cyan-700',
  voip: 'bg-indigo-100 text-indigo-700',
  email: 'bg-indigo-100 text-indigo-700',
  loyalty: 'bg-purple-100 text-purple-700',
  marketing: 'bg-orange-100 text-orange-700',
  community: 'bg-pink-100 text-pink-700',
  accounting: 'bg-emerald-100 text-emerald-700',
  system: 'bg-slate-100 text-slate-700',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineEvent {
  id: string;
  module: BridgeModule;
  type: string;
  title: string;
  description: string | null;
  timestamp: string;
  link?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityTimelineWidget({
  entityId,
  entityType: _entityType = 'user',
  limit = 10,
  modules,
  t,
  locale,
}: {
  entityId: string | null;
  entityType?: 'user' | 'deal' | 'order';
  limit?: number;
  modules?: BridgeModule[];
  t: (key: string) => string;
  locale: string;
}) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!entityId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    setError(false);

    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (modules) params.set('modules', modules.join(','));

    fetch(`/api/admin/timeline/${entityId}?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const data = json?.data ?? json;
        setEvents(data.events ?? []);
        setCursor(data.cursor ?? null);
        setHasMore(!!data.cursor);
      })
      .catch(() => {
        setEvents([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [entityId, limit, modules]);

  const loadMore = async () => {
    if (!cursor || loadingMore || !entityId) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('cursor', cursor);
      if (modules) params.set('modules', modules.join(','));

      const res = await fetch(`/api/admin/timeline/${entityId}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json?.data ?? json;
      setEvents((prev) => [...prev, ...(data.events ?? [])]);
      setCursor(data.cursor ?? null);
      setHasMore(!!data.cursor);
    } catch {
      // Silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  // ── No entity ───────────────────────────────────────────────
  if (!entityId) return null;

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-slate-500" />
          {t('admin.bridges.activityTimeline') || 'Activity Timeline'}
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-slate-200 rounded w-3/4 mb-1" />
                <div className="h-2.5 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-slate-500" />
          {t('admin.bridges.activityTimeline') || 'Activity Timeline'}
        </h3>
        <p className="text-sm text-slate-400 italic">
          {t('admin.bridges.noData') || 'No data available'}
        </p>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-slate-500" />
          {t('admin.bridges.activityTimeline') || 'Activity Timeline'}
        </h3>
        <p className="text-sm text-slate-400 italic py-2">
          {t('admin.bridges.noData') || 'No data available'}
        </p>
      </div>
    );
  }

  // ── Render timeline ─────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-slate-500" />
        {t('admin.bridges.activityTimeline') || 'Activity Timeline'}
        <span className="ms-auto text-xs font-normal text-slate-400">
          {events.length} {t('admin.bridges.events') || 'events'}
        </span>
      </h3>

      <div className="space-y-1">
        {events.map((event) => {
          const Icon = MODULE_ICONS[event.module] || Shield;
          const colorClass = MODULE_COLORS[event.module] || MODULE_COLORS.system;
          const time = new Date(event.timestamp).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
          });
          const date = new Date(event.timestamp).toLocaleDateString(locale);

          const content = (
            <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className={`p-1.5 rounded-lg flex-shrink-0 ${colorClass}`}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-800 truncate">
                    {event.title}
                  </p>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {time}
                  </span>
                </div>
                {event.description && (
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    {event.description}
                  </p>
                )}
                <p className="text-[10px] text-slate-300 mt-0.5">{date}</p>
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

      {/* Load more */}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {t('admin.bridges.viewAll') || 'View all'}
          </button>
        </div>
      )}
    </div>
  );
}
