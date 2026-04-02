import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
  mobileHide?: boolean;  // hide this column in mobile card view
  mobilePrimary?: boolean; // display prominently in card header
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  rowKey?: (row: T) => string;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  pagination,
  onSort,
  sortKey,
  sortOrder,
  onRowClick,
  emptyMessage = 'Aucune donnée disponible',
  rowKey,
}: DataTableProps<T>) {
  const [localSort, setLocalSort] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    if (!onSort) return;
    const isCurrentSort = sortKey === key || localSort?.key === key;
    const newOrder = isCurrentSort && (sortOrder || localSort?.order) === 'asc' ? 'desc' : 'asc';
    setLocalSort({ key, order: newOrder });
    onSort(key, newOrder);
  };

  const getSortIcon = (key: string) => {
    const isCurrentSort = sortKey === key || localSort?.key === key;
    const order = sortKey === key ? sortOrder : localSort?.order;
    if (!isCurrentSort) return <ChevronsUpDown size={14} className="text-gray-400" />;
    return order === 'asc' ? (
      <ChevronUp size={14} className="text-red-600" />
    ) : (
      <ChevronDown size={14} className="text-red-600" />
    );
  };

  const getNestedValue = (obj: T, key: string): unknown => {
    return key.split('.').reduce((acc: unknown, part) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, obj as unknown);
  };

  const paginationBlock = pagination && pagination.totalPages > 1 && (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 flex-wrap gap-2">
      <div className="text-xs text-gray-500">
        {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => pagination.onPageChange(pagination.page - 1)}
          disabled={pagination.page === 1}
          className="btn btn-secondary btn-sm"
        >
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
          const page = Math.max(1, Math.min(pagination.totalPages - 4, pagination.page - 2)) + i;
          return (
            <button
              key={page}
              onClick={() => pagination.onPageChange(page)}
              className={clsx('btn btn-sm min-w-[2rem]', page === pagination.page ? 'btn-primary' : 'btn-secondary')}
            >
              {page}
            </button>
          );
        })}
        <button
          onClick={() => pagination.onPageChange(pagination.page + 1)}
          disabled={pagination.page === pagination.totalPages}
          className="btn btn-secondary btn-sm"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div>
        {/* Desktop skeleton */}
        <div className="hidden sm:block table-container">
          <table className="table">
            <thead>
              <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key}><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile skeleton */}
        <div className="sm:hidden space-y-2 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
              <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const primaryCol = columns.find((c) => c.mobilePrimary) || columns[0];
  const secondaryCol = columns.find((c) => !c.mobilePrimary && !c.mobileHide && c !== primaryCol);
  const visibleCols = columns.filter((c) => !c.mobileHide && c !== primaryCol && c !== secondaryCol);

  return (
    <div>
      {/* ── Desktop table ── */}
      <div className="hidden sm:block table-container">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(col.className, col.sortable && 'cursor-pointer select-none hover:bg-gray-100')}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && getSortIcon(col.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-gray-400">{emptyMessage}</td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={rowKey ? rowKey(row) : index}
                  className={clsx(onRowClick && 'cursor-pointer')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => {
                    const value = getNestedValue(row, col.key);
                    return (
                      <td key={col.key} className={col.className}>
                        {col.render ? col.render(value, row) : String(value ?? '-')}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile card list ── */}
      <div className="sm:hidden">
        {data.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">{emptyMessage}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.map((row, index) => {
              const primaryVal = getNestedValue(row, primaryCol.key);
              const secondaryVal = secondaryCol ? getNestedValue(row, secondaryCol.key) : undefined;
              return (
                <div
                  key={rowKey ? rowKey(row) : index}
                  className={clsx(
                    'px-4 py-3 bg-white flex flex-col gap-1',
                    onRowClick && 'cursor-pointer active:bg-gray-50'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {/* Primary + secondary on same row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-gray-900 text-sm">
                      {primaryCol.render ? primaryCol.render(primaryVal, row) : String(primaryVal ?? '-')}
                    </div>
                    {secondaryCol && (
                      <div className="text-sm text-gray-500 shrink-0">
                        {secondaryCol.render ? secondaryCol.render(secondaryVal, row) : String(secondaryVal ?? '-')}
                      </div>
                    )}
                  </div>
                  {/* Remaining visible columns */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {visibleCols.map((col) => {
                      const val = getNestedValue(row, col.key);
                      return (
                        <span key={col.key} className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="text-gray-400">{col.label}:</span>
                          {col.render ? col.render(val, row) : String(val ?? '-')}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {paginationBlock}
    </div>
  );
}
