/**
 * REVORA – DataTable
 * Generic, reusable table with sorting headers, empty state, and loading skeleton.
 */

import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './LoadingSkeleton';
import type { SortState } from '@/types';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  sort?: SortState;
  onSort?: (field: string) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyTitle = 'No records found',
  emptyDescription = 'There is no data to display yet.',
  sort,
  onSort,
  className,
}: DataTableProps<T>) {
  if (loading) return <TableSkeleton rows={6} cols={columns.length} />;

  return (
    <div className={cn('table-wrapper', className)}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sort?.field === col.key;
              const SortIcon = isSorted
                ? sort?.direction === 'asc' ? ChevronUp : ChevronDown
                : ChevronsUpDown;

              return (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    col.sortable && onSort && 'cursor-pointer select-none hover:bg-slate-100 transition-colors',
                    col.align === 'right'  && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <SortIcon
                        className={cn(
                          'w-3.5 h-3.5 flex-shrink-0',
                          isSorted ? 'text-indigo-600' : 'text-slate-400',
                        )}
                      />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                <EmptyState title={emptyTitle} description={emptyDescription} compact />
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={keyExtractor(row, idx)}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      col.align === 'right'  && 'text-right',
                      col.align === 'center' && 'text-center',
                    )}
                  >
                    {col.render(row, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
