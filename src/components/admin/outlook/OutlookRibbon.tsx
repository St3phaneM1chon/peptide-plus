'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useAdminLayout } from '@/lib/admin/admin-layout-context';
import { getRibbonConfig } from '@/lib/admin/ribbon-config';
import { folderSections } from '@/lib/admin/outlook-nav';
import type { RibbonAction, RibbonTab } from '@/lib/admin/ribbon-config';

// ── NavDropdown for dashboard mega-nav ────────────────────────

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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const section = tab.railId ? folderSections[tab.railId] : null;
  if (!section) return null;

  // Flatten all items from all groups
  const allItems = section.groups.flatMap((g) => g.items);

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
        <div className="absolute top-full left-0 mt-px z-50 bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-[200px]">
          {allItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
              onClick={() => setOpen(false)}
            >
              <item.icon className="w-3.5 h-3.5 text-slate-400" />
              {t(item.labelKey)}
            </a>
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
                onClick={() => setOpen(false)}
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
  const searchParams = useSearchParams();

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
