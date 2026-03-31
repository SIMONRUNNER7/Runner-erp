import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
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
      <ChevronUp size={14} className="text-blue-600" />
    ) : (
      <ChevronDown size={14} className="text-blue-600" />
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

  if (loading) {
    return (
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key}>
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div className="table-container">
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
                <td colSpan={columns.length} className="text-center py-12 text-gray-400">
                  {emptyMessage}
                </td>
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

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} sur {pagination.total} résultats
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
                  className={clsx(
                    'btn btn-sm min-w-[2rem]',
                    page === pagination.page ? 'btn-primary' : 'btn-secondary'
                  )}
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
      )}
    </div>
  );
}
