'use client';

import type { ReactNode } from 'react';
import type { SectionTheme } from '@/lib/admin/section-themes';

interface SectionCardProps {
  children: ReactNode;
  /** Card title */
  title?: string;
  /** Right-side actions for the card header */
  headerAction?: ReactNode;
  /** Section theme for accent top border */
  theme?: SectionTheme;
  /** Additional className */
  className?: string;
  /** Remove default padding */
  noPadding?: boolean;
}

export function SectionCard({ children, title, headerAction, theme, className = '', noPadding }: SectionCardProps) {
  const accentBorder = theme ? `border-t-2 ${theme.accentBar.replace('border-l-', 'border-t-')}` : '';

  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${accentBorder} ${className}`}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          {title && <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>}
          {headerAction}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
}
