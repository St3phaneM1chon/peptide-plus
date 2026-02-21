'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface RibbonTab {
  key: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

interface RibbonBreadcrumb {
  label: string;
  href?: string;
}

interface OutlookRibbonProps {
  tabs?: RibbonTab[];
  actions?: React.ReactNode;
  breadcrumbs?: RibbonBreadcrumb[];
  title?: string;
  subtitle?: string;
}

export default function OutlookRibbon({
  tabs,
  actions,
  breadcrumbs,
  title,
  subtitle,
}: OutlookRibbonProps) {
  const hasContent = tabs || actions || breadcrumbs || title;
  if (!hasContent) return null;

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-2">
      {/* Breadcrumbs row */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 mb-1" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={index} className="flex items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0 rtl:rotate-180" />
                )}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={`text-xs ${
                      isLast ? 'text-slate-700 font-medium' : 'text-slate-500'
                    }`}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {/* Title + Actions row */}
      {(title || actions) && (
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            {title && (
              <h1 className="text-lg font-semibold text-slate-900 truncate">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm text-slate-500 truncate">{subtitle}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0 ms-4">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Tabs row */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-0 mt-1 -mb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={tab.onClick}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab.active
                  ? 'border-sky-700 text-sky-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
