'use client';

import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/i18n/client';

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode; // Additional filter controls
  actions?: ReactNode;  // Right-side actions
}

export function FilterBar({ searchValue, onSearchChange, searchPlaceholder: searchPlaceholderProp, children, actions }: FilterBarProps) {
  const { t } = useI18n();
  const searchPlaceholder = searchPlaceholderProp || t('common.search') || 'Search...';
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
      {onSearchChange && (
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchValue || ''}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 ps-9 pe-8 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-sky-700 transition-shadow"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute end-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      )}
      {children && (
        <div className="flex items-center gap-2 flex-wrap">
          {children}
        </div>
      )}
      {actions && (
        <div className="flex items-center gap-2 sm:ms-auto">
          {actions}
        </div>
      )}
    </div>
  );
}

// Reusable select filter
interface SelectFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function SelectFilter({ label, value, onChange, options }: SelectFilterProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-700
        bg-white focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-sky-700"
      aria-label={label}
    >
      <option value="">{label}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
