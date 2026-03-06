'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useAdminLayout } from '@/lib/admin/admin-layout-context';
import { getRibbonConfig } from '@/lib/admin/ribbon-config';
import { folderSections } from '@/lib/admin/outlook-nav';
import type { NavFolderGroup } from '@/lib/admin/outlook-nav';
import { dispatchRibbonAction } from '@/hooks/useRibbonAction';
import type { RibbonAction, RibbonTab } from '@/lib/admin/ribbon-config';

// ── Collapsible group inside mega-menu ──────────────────────
function DropdownGroup({
  group,
  onClose,
  t,
}: {
  group: NavFolderGroup;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(group.defaultOpen !== false);
  const hasHeader = !!group.labelKey;
  const isCollapsible = group.collapsible === true;

  return (
    <div className="min-w-0">
      {hasHeader && (
        <button
          type="button"
          onClick={isCollapsible ? () => setExpanded((v) => !v) : undefined}
          className={`flex items-center gap-1 w-full px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${
            isCollapsible ? 'cursor-pointer hover:text-slate-600' : 'cursor-default'
          }`}
        >
          {isCollapsible && (
            <ChevronRight
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          )}
          <span className="truncate">{t(group.labelKey!)}</span>
        </button>
      )}
      {expanded &&
        group.items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 rounded transition-colors"
            onClick={onClose}
          >
            <item.icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            <span className="truncate">{t(item.labelKey)}</span>
          </a>
        ))}
    </div>
  );
}

// ── NavDropdown for dashboard mega-nav (mega-menu or simple) ─
function NavDropdownTab({
  tab,
  isActive,
  onSelect,
}: {
  tab: RibbonTab;
  isActive: boolean;
  onSelect: (key: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [alignRight, setAlignRight] = useState(false);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Detect overflow — shift to right-aligned if panel exceeds viewport
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      setAlignRight(true);
    } else {
      setAlignRight(false);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const section = tab.railId ? folderSections[tab.railId] : null;
  // Never return null — doing so removes the element and shifts siblings,
  // causing a hydration mismatch between server (renders all) and client.
  if (!section) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => { setOpen(!open); onSelect(tab.key); }}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
            isActive || open
              ? 'text-sky-700 border-b-2 border-sky-700 -mb-px'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {t(tab.labelKey)}
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const groups = section.groups;
  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);
  const isSimple = groups.length <= 1 && totalItems <= 8;

  // Grid columns based on group count
  const gridClass = isSimple
    ? 'min-w-[200px]'
    : groups.length <= 3
      ? 'min-w-[420px] grid grid-cols-2 gap-x-3'
      : groups.length <= 5
        ? 'min-w-[480px] grid grid-cols-2 gap-x-3'
        : 'min-w-[640px] grid grid-cols-3 gap-x-3';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); onSelect(tab.key); }}
        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
          isActive || open
            ? 'text-sky-700 border-b-2 border-sky-700 -mb-px'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {t(tab.labelKey)}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className={`absolute top-full mt-px z-50 bg-white border border-slate-200 rounded-md shadow-lg p-2 max-h-[70vh] overflow-y-auto ${gridClass} ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          {isSimple
            ? groups.flatMap((g) => g.items).map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 rounded transition-colors"
                  onClick={close}
                >
                  <item.icon className="w-3.5 h-3.5 text-slate-400" />
                  {t(item.labelKey)}
                </a>
              ))
            : groups.map((group, i) => (
                <DropdownGroup key={group.labelKey ?? `g${i}`} group={group} onClose={close} t={t} />
              ))}
        </div>
      )}
    </div>
  );
}

// ── ActionDropdown for dropdown-type actions ──────────────────

function ActionDropdown({ action }: { action: RibbonAction }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const Icon = action.icon;

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors text-slate-600 hover:bg-slate-100 whitespace-nowrap"
        title={t(action.labelKey)}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t(action.labelKey)}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && action.dropdownItems && (
        <div className="absolute top-full left-0 mt-px z-50 bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-[160px]">
          {action.dropdownItems.map((item) => (
            item.href ? (
              <a
                key={item.key}
                href={item.href}
                className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                onClick={() => setOpen(false)}
              >
                {t(item.labelKey)}
              </a>
            ) : (
              <button
                key={item.key}
                type="button"
                className="block w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                onClick={() => { dispatchRibbonAction(item.key); setOpen(false); }}
              >
                {t(item.labelKey)}
              </button>
            )
          ))}
        </div>
      )}

      {action.separator && (
        <div className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0" />
      )}
    </div>
  );
}

// ── Main Ribbon ──────────────────────────────────────────────

export default function OutlookRibbon() {
  const { t } = useI18n();
  const { activeRailId } = useAdminLayout();
  const pathname = usePathname();

  // searchParams: null on SSR + initial hydration (safe), updated after mount.
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);
  useEffect(() => {
    setSearchParams(new URLSearchParams(window.location.search));
  }, [pathname]);

  const config = getRibbonConfig(activeRailId, pathname, searchParams);
  const [activeTab, setActiveTab] = useState('home');

  const actions: RibbonAction[] = config.actions[activeTab] ?? [];
  if (config.tabs.length === 0 && actions.length === 0) return null;

  return (
    <div className="bg-white border-b border-slate-200 select-none">
      {/* Ribbon tabs */}
      <div className="flex items-center border-b border-slate-100 px-2">
        {config.tabs.map((tab) => {
          // Dashboard mega-nav dropdown tabs
          if (tab.type === 'navDropdown') {
            return (
              <NavDropdownTab
                key={tab.key}
                tab={tab}
                isActive={activeTab === tab.key}
                onSelect={setActiveTab}
              />
            );
          }

          // Standard tab button
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-sky-700 border-b-2 border-sky-700 -mb-px'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Ribbon actions bar */}
      {actions.length > 0 && (
        <div className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto outlook-scroll">
          {actions.map((action) => {
            // Dropdown-type actions
            if (action.type === 'dropdown') {
              return <ActionDropdown key={action.key} action={action} />;
            }

            // Standard button actions
            const Icon = action.icon;
            const isP = action.variant === 'primary';
            const isD = action.variant === 'danger';
            return (
              <div key={action.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => dispatchRibbonAction(action.key)}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap
                    ${isP
                      ? 'bg-sky-600 text-white hover:bg-sky-700'
                      : isD
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-slate-600 hover:bg-slate-100'
                    }
                  `}
                  title={t(action.labelKey)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t(action.labelKey)}</span>
                </button>
                {action.separator && (
                  <div className="w-px h-5 bg-slate-200 mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
