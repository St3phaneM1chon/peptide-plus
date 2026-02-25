'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useAdminLayout } from '@/lib/admin/admin-layout-context';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { useNavPages } from '@/hooks/useNavPages';
import ChatPreview from './ChatPreview';
import { folderSections } from '@/lib/admin/outlook-nav';
import type { NavFolderGroup, NavFolderItem } from '@/lib/admin/outlook-nav';

// ── Badge resolver ──────────────────────────────────────────────

function useBadgeValues(): Record<string, number> {
  const { pendingOrders, unreadChats } = useAdminNotifications();
  return {
    pendingOrders: pendingOrders,
    unreadChats: unreadChats,
    inboxCount: 0,
  };
}

// ── Collapsible Group ───────────────────────────────────────────

function FolderGroup({
  group,
  pathname,
  t,
  badgeValues,
}: {
  group: NavFolderGroup;
  pathname: string;
  t: (key: string) => string;
  badgeValues: Record<string, number>;
}) {
  const [open, setOpen] = useState(group.defaultOpen !== false);
  const isCollapsible = group.collapsible === true;

  return (
    <div className="mb-1">
      {/* Group header */}
      {group.labelKey && (
        <button
          type="button"
          onClick={() => {
            if (isCollapsible) setOpen((prev) => !prev);
          }}
          className={`
            w-full flex items-center gap-1.5 px-2 py-1.5
            text-[11px] font-semibold text-slate-500 uppercase tracking-wider
            ${isCollapsible ? 'hover:text-slate-700 cursor-pointer' : 'cursor-default'}
            transition-colors
          `}
          aria-expanded={isCollapsible ? open : undefined}
        >
          {isCollapsible && (
            open
              ? <ChevronDown className="w-3 h-3 flex-shrink-0" />
              : <ChevronRight className="w-3 h-3 flex-shrink-0" />
          )}
          <span>{group.labelKey?.startsWith('_dynamic_:') ? group.labelKey.slice(10) : t(group.labelKey)}</span>
        </button>
      )}

      {/* Items */}
      {open && (
        <div className="space-y-px">
          {group.items.map((item) => (
            <FolderItem
              key={item.href}
              item={item}
              pathname={pathname}
              t={t}
              badgeValues={badgeValues}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single Folder Item ──────────────────────────────────────────

function FolderItem({
  item,
  pathname,
  t,
  badgeValues,
  depth = 0,
}: {
  item: NavFolderItem;
  pathname: string;
  t: (key: string) => string;
  badgeValues: Record<string, number>;
  depth?: number;
}) {
  const [childrenOpen, setChildrenOpen] = useState(true);
  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;

  // Determine if this item is active
  const isActive = useMemo(() => {
    // For items with query params, do exact match
    if (item.href.includes('?')) {
      return pathname + (typeof window !== 'undefined' ? window.location.search : '') === item.href;
    }
    // For regular items, match the path
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }, [pathname, item.href]);

  // Resolve badge count
  const badgeCount = item.badge ? (badgeValues[item.badge] ?? 0) : 0;

  return (
    <>
      <Link
        href={item.href}
        className={`
          flex items-center gap-2.5 px-2.5 py-[6px] rounded-sm transition-colors
          text-[13px] group
          ${isActive
            ? 'bg-sky-100 text-sky-900 border-s-[3px] border-s-sky-700'
            : 'border-s-[3px] border-s-transparent text-slate-700 hover:bg-slate-50'
          }
          ${depth > 0 ? 'ps-8' : ''}
        `}
        aria-current={isActive ? 'page' : undefined}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt=""
            width={18}
            height={18}
            className="w-[18px] h-[18px] object-contain flex-shrink-0 transition-transform duration-200 group-hover:scale-125"
          />
        ) : (
          <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-sky-700' : 'text-slate-400 group-hover:text-slate-500'}`} />
        )}
        <span className="flex-1 truncate">{item.labelKey.startsWith('_dynamic_:') ? item.labelKey.slice(10) : t(item.labelKey)}</span>

        {/* Badge */}
        {badgeCount > 0 && (
          <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5 leading-none font-medium flex-shrink-0">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}

        {/* Children toggle */}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setChildrenOpen((prev) => !prev);
            }}
            className="p-0.5 hover:bg-slate-200 rounded transition-colors flex-shrink-0"
            aria-label={t('admin.outlook.toggleSubItems') || 'Toggle sub-items'}
          >
            {childrenOpen
              ? <ChevronDown className="w-3 h-3 text-slate-400" />
              : <ChevronRight className="w-3 h-3 text-slate-400" />
            }
          </button>
        )}
      </Link>

      {/* Nested children */}
      {hasChildren && childrenOpen && item.children!.map((child) => (
        <FolderItem
          key={child.href}
          item={child}
          pathname={pathname}
          t={t}
          badgeValues={badgeValues}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────

export default function FolderPane() {
  const pathname = usePathname();
  const { t, dir } = useI18n();
  const { activeRailId, toggleFolderPane } = useAdminLayout();
  const badgeValues = useBadgeValues();
  const dynamicGroups = useNavPages(activeRailId);

  const section = folderSections[activeRailId];
  if (!section) return null;

  const allGroups = dynamicGroups.length > 0
    ? [...section.groups, ...dynamicGroups]
    : section.groups;

  return (
    <aside
      className="w-[260px] h-full bg-white border-e border-slate-200 flex flex-col flex-shrink-0"
      aria-label={t('admin.outlook.sectionNavigation') || 'Section navigation'}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900 truncate">
          {t(section.title)}
        </h2>
        <button
          type="button"
          onClick={toggleFolderPane}
          title={t('admin.outlook.collapsePane')}
          aria-label={t('admin.outlook.collapsePane')}
          className="p-1 hover:bg-slate-100 rounded transition-colors flex-shrink-0"
        >
          <ChevronRight className={`w-4 h-4 text-slate-400 ${dir === 'rtl' ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Scrollable tree */}
      <nav className="flex-1 overflow-y-auto outlook-scroll px-2 py-2">
        {allGroups.map((group, idx) => (
          <FolderGroup
            key={group.labelKey ?? `group-${idx}`}
            group={group}
            pathname={pathname}
            t={t}
            badgeValues={badgeValues}
          />
        ))}
      </nav>

      {/* Chat messages preview widget */}
      <ChatPreview />
    </aside>
  );
}
