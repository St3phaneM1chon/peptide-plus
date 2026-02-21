'use client';

import { useState, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  selectedIds?: Set<string>;
  onSelectChange?: (ids: Set<string>) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onSort,
  sortKey,
  sortDirection,
  loading,
  emptyTitle = 'No data',
  emptyDescription,
  emptyAction,
  onRowClick,
  selectedIds,
  onSelectChange,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const currentSort = sortKey ? { key: sortKey, dir: sortDirection || 'asc' } : internalSort;

  const handleSort = (key: string) => {
    const newDir = currentSort?.key === key && currentSort.dir === 'asc' ? 'desc' : 'asc';
    if (onSort) {
      onSort(key, newDir);
    } else {
      setInternalSort({ key, dir: newDir });
    }
  };

  const selectable = !!onSelectChange;
  const allSelected = data.length > 0 && selectedIds?.size === data.length;

  const toggleAll = () => {
    if (!onSelectChange) return;
    if (allSelected) {
      onSelectChange(new Set());
    } else {
      onSelectChange(new Set(data.map(keyExtractor)));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectChange(next);
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="animate-pulse">
          <div className="h-11 bg-slate-50 border-b border-slate-200" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 border-b border-slate-100 px-4 flex items-center gap-4">
              <div className="h-4 bg-slate-100 rounded w-1/4" />
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-1/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg">
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {data.length} {data.length === 1 ? 'row' : 'rows'}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {selectable && (
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-sky-700 focus:ring-sky-700"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider
                    ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-end' : 'text-start'}
                    ${col.sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''}
                  `}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      currentSort?.key === col.key ? (
                        currentSort.dir === 'asc' ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, index) => {
              const id = keyExtractor(row);
              return (
                <tr
                  key={id}
                  className={`
                    transition-colors duration-150
                    ${onRowClick ? 'cursor-pointer hover:bg-slate-50/70' : ''}
                    ${selectedIds?.has(id) ? 'bg-sky-100' : ''}
                  `}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(id) || false}
                        onChange={() => toggleOne(id)}
                        className="rounded border-slate-300 text-sky-700 focus:ring-sky-700"
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm text-slate-700
                        ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-end' : ''}
                      `}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
