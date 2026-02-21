'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import { useAdminLayout } from '@/lib/admin/admin-layout-context';
import { getRibbonConfig } from '@/lib/admin/ribbon-config';
import type { RibbonAction } from '@/lib/admin/ribbon-config';

export default function OutlookRibbon() {
  const { t } = useI18n();
  const { activeRailId } = useAdminLayout();
  const config = getRibbonConfig(activeRailId);
  const [activeTab, setActiveTab] = useState('home');

  const actions: RibbonAction[] = config.actions[activeTab] ?? [];
  if (config.tabs.length === 0 && actions.length === 0) return null;

  return (
    <div className="bg-white border-b border-slate-200 select-none">
      {/* Ribbon tabs */}
      <div className="flex items-center border-b border-slate-100 px-2">
        {config.tabs.map((tab) => (
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
        ))}
      </div>

      {/* Ribbon actions bar */}
      {actions.length > 0 && (
        <div className="flex items-center gap-0.5 px-2 py-1 overflow-x-auto outlook-scroll">
          {actions.map((action) => {
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
