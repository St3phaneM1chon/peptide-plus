'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { SectionTheme } from '@/lib/admin/section-themes';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  /** Section theme for accent styling */
  theme?: SectionTheme;
}

export function PageHeader({ title, subtitle, backHref, backLabel, actions, badge, theme }: PageHeaderProps) {
  return (
    <div className={`mb-6 ${theme ? `border-l-4 ${theme.accentBar} pl-4` : ''}`}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel || 'Back'}
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
