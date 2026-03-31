import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Filter, Send, DollarSign } from 'lucide-react';
import { invoicesApi } from '../lib/api';
import DataTable, { Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import KPICard from '../components/KPICard';
import { format } from 'date-fns';
import { FileText, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

export default function Invoices() {
  const queryClient = useQueryClient();
  const { canAccess } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, search, status, sortBy, sortOrder],
    queryFn: () =>
      invoicesApi.list({ page, limit: 20, search, status, sortBy, sortOrder }).then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: () => invoicesApi.stats().then((r) => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: () => invoicesApi.sync(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => invoicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.sendReminder(id),
  });

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'invoiceNumber',
      label: 'N° Facture',
      sortable: true,
      render: (val, row) => (
        <span className="font-medium text-blue-600">
          {(val as string) || (row.id as string).slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'client.name',
      label: 'Client',
      render: (_val, row) => {
        const client = row.client as { name: string } | undefined;
        return client?.name || '—';
      },
    },
    {
      key: 'order.shopifyNumber',
      label: 'Commande',
      render: (_val, row) => {
        const order = row.order as { shopifyNumber?: string; id?: string } | undefined;
        return order?.shopifyNumber || (order ? order.id?.slice(0, 8) : '—');
      },
    },
    {
      key: 'totalAmount',
      label: 'Montant TTC',
      sortable: true,
      render: (val) => <span className="font-semibold">{formatCurrency(val as number)}</span>,
    },
    {
      key: 'status',
      label: 'Statut',
      render: (val) => <StatusBadge status={val as string} />,
    },
    {
      key: 'dueDate',
      label: 'Échéance',
      sortable: true,
      render: (val, row) => {
        if (!val) return '—';
        const date = new Date(val as string);
        const isOverdue = row.status !== 'paid' && date < new Date();
        return (
          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
            {format(date, 'dd/MM/yyyy')}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Créée le',
      sortable: true,
      render: (val) => format(new Date(val as string), 'dd/MM/yyyy'),
    },
    ...(canAccess(['president', 'comptable'])
      ? [{
          key: 'id',
          label: 'Actions',
          render: (val: unknown, row: Record<string, unknown>) => (
            <div className="flex items-center gap-1">
              {row.status !== 'paid' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateMutation.mutate({ id: val as string, data: { status: 'paid' } });
                  }}
                  className="btn btn-sm bg-green-500 text-white hover:bg-green-600"
                >
                  <DollarSign size={12} />
                  Payée
                </button>
              )}
              {(row.status === 'sent' || row.status === 'overdue') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reminderMutation.mutate(val as string);
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  <Send size={12} />
                  Relance
                </button>
              )}
            </div>
          ),
        }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.pagination?.total || 0} factures</p>
        </div>
        <div className="flex items-center gap-2">
          {canAccess(['president', 'comptable']) && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="btn btn-secondary"
            >
              <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
              Sync Vos Factures
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total factures" value={stats.total} icon={FileText} color="blue" />
          <KPICard title="Payées" value={stats.paid} icon={DollarSign} color="green" />
          <KPICard title="En retard" value={stats.overdue} icon={AlertTriangle} color={stats.overdue > 0 ? 'red' : 'green'} />
          <KPICard title="CA ce mois" value={formatCurrency(stats.monthRevenue)} icon={DollarSign} color="cyan" />
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Rechercher par numéro, client..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              className="input w-auto"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">Tous les statuts</option>
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <DataTable
          columns={columns}
          data={(data?.data || []) as Record<string, unknown>[]}
          loading={isLoading}
          pagination={data?.pagination ? { ...data.pagination, onPageChange: setPage } : undefined}
          onSort={(key, order) => { setSortBy(key); setSortOrder(order); }}
          sortKey={sortBy}
          sortOrder={sortOrder}
          rowKey={(row) => row.id as string}
          emptyMessage="Aucune facture trouvée"
        />
      </div>
    </div>
  );
}
