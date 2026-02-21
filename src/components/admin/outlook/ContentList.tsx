'use client';

import React, { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { AvatarCircle } from './AvatarCircle';

// ── Types ──────────────────────────────────────────────────────

interface ContentListItem {
  id: string;
  avatar?: { text: string; color?: string; imageUrl?: string };
  title: string;
  subtitle?: string;
  preview?: string;
  timestamp?: string | Date;
  badges?: { text: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' }[];
  unread?: boolean;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
}

interface ContentListGroup {
  label: string;
  items: ContentListItem[];
  defaultOpen?: boolean;
}

interface ContentListProps {
  items?: ContentListItem[];
  groups?: ContentListGroup[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  filterTabs?: { key: string; label: string; count?: number }[];
  activeFilter?: string;
  onFilterChange?: (key: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  loading?: boolean;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyTitle?: string;
  emptyDescription?: string;
  headerActions?: React.ReactNode;
  className?: string;
}

// ── Badge variant colors ───────────────────────────────────────

const badgeVariants: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
  info: 'bg-sky-50 text-sky-700',
  neutral: 'bg-slate-100 text-slate-600',
};

// ── Timestamp formatting ───────────────────────────────────────

function formatTimestamp(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const now = new Date();

  // Invalid date guard
  if (isNaN(date.getTime())) return '';

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Hier ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // This week (within last 7 days)
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return dayNames[date.getDay()];
  }

  // Older
  const monthNames = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec'];
  return `${date.getDate()} ${monthNames[date.getMonth()]}`;
}

// ── Skeleton loader ────────────────────────────────────────────

function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 animate-pulse">
      <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 bg-slate-200 rounded w-2/3" />
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        <div className="h-3 bg-slate-100 rounded w-full" />
      </div>
      <div className="h-3 bg-slate-100 rounded w-10 flex-shrink-0" />
    </div>
  );
}

// ── Single item row ────────────────────────────────────────────

function ListItem({
  item,
  selected,
  onSelect,
}: {
  item: ContentListItem;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const isUrgent = item.priority === 'urgent';

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`
        w-full text-start flex items-start gap-3 px-4 py-3 border-b border-slate-100
        transition-colors duration-100 cursor-pointer outline-none
        ${selected
          ? 'bg-sky-100 border-s-[3px] border-s-sky-700'
          : isUrgent
            ? 'border-s-[3px] border-s-red-500 hover:bg-slate-50'
            : 'border-s-[3px] border-s-transparent hover:bg-slate-50'
        }
        focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset
      `}
    >
      {/* Avatar */}
      {item.avatar && (
        <AvatarCircle
          name={item.avatar.text}
          imageUrl={item.avatar.imageUrl}
          size="md"
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {item.unread && (
            <span className="w-2 h-2 bg-sky-600 rounded-full flex-shrink-0" />
          )}
          <span
            className={`text-sm truncate ${
              item.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
            }`}
          >
            {item.title}
          </span>
        </div>

        {item.subtitle && (
          <p className="text-xs text-sky-700 truncate mt-0.5">{item.subtitle}</p>
        )}

        {item.preview && (
          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{item.preview}</p>
        )}

        {item.badges && item.badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {item.badges.map((badge, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badgeVariants[badge.variant]}`}
              >
                {badge.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp */}
      {item.timestamp && (
        <span className="text-[11px] text-slate-400 flex-shrink-0 whitespace-nowrap pt-0.5">
          {formatTimestamp(item.timestamp)}
        </span>
      )}
    </button>
  );
}

// ── Collapsible group ──────────────────────────────────────────

function Group({
  group,
  selectedId,
  onSelect,
}: {
  group: ContentListGroup;
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(group.defaultOpen !== false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:bg-slate-50 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        <span>{group.label}</span>
        <span className="text-slate-400 font-normal normal-case">({group.items.length})</span>
      </button>

      {open &&
        group.items.map((item) => (
          <ListItem
            key={item.id}
            item={item}
            selected={selectedId === item.id}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export function ContentList({
  items,
  groups,
  selectedId,
  onSelect,
  filterTabs,
  activeFilter,
  onFilterChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  loading = false,
  emptyIcon: EmptyIcon = Inbox,
  emptyTitle = 'Aucun element',
  emptyDescription = 'Aucun element a afficher.',
  headerActions,
  className = '',
}: ContentListProps) {
  const allItems = items ?? [];
  const allGroups = groups ?? [];
  const hasContent = allItems.length > 0 || allGroups.some((g) => g.items.length > 0);

  return (
    <div className={`flex flex-col h-full bg-white border-e border-slate-200 ${className}`}>
      {/* Header: filter tabs + actions */}
      {(filterTabs || headerActions) && (
        <div className="flex items-center justify-between border-b border-slate-200 px-2">
          {filterTabs && (
            <div className="flex items-center gap-0 overflow-x-auto">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onFilterChange?.(tab.key)}
                  className={`
                    px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors
                    ${activeFilter === tab.key
                      ? 'border-sky-700 text-sky-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }
                  `}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className={`ms-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                        activeFilter === tab.key
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {headerActions && (
            <div className="flex items-center gap-1 ms-auto ps-2">{headerActions}</div>
          )}
        </div>
      )}

      {/* Search bar */}
      {onSearchChange && (
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full ps-8 pe-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md
                         placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500
                         focus:border-sky-500 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Screen reader announcement for result count */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {allItems.length + allGroups.reduce((sum, g) => sum + g.items.length, 0)} {allItems.length + allGroups.reduce((sum, g) => sum + g.items.length, 0) === 1 ? 'result' : 'results'}
      </div>

      {/* Scrollable list area */}
      <div className="flex-1 overflow-y-auto outlook-scroll">
        {loading ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : !hasContent ? (
          <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
            <EmptyIcon className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">{emptyTitle}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">{emptyDescription}</p>
          </div>
        ) : (
          <>
            {/* Flat items */}
            {allItems.map((item) => (
              <ListItem
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onSelect={onSelect}
              />
            ))}

            {/* Grouped items */}
            {allGroups.map((group, idx) => (
              <Group
                key={idx}
                group={group}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export type { ContentListItem, ContentListGroup, ContentListProps };
