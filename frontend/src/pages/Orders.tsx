import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Plus, Filter } from 'lucide-react';
import { ordersApi } from '../lib/api';
import DataTable, { Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const ORDER_STATUSES = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'];

export default function Orders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccess } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, search, status, sortBy, sortOrder],
    queryFn: () =>
      ordersApi.list({ page, limit: 20, search, status, sortBy, sortOrder }).then((r) => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: () => ordersApi.syncShopify(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const syncMetafieldsMutation = useMutation({
    mutationFn: () => ordersApi.syncAllMetafields(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'shopifyNumber',
      label: 'Commande',
      sortable: true,
      render: (val, row) => (
        <span className="font-medium text-blue-600">
          {(val as string) || `#${(row.id as string).slice(0, 8)}`}
        </span>
      ),
    },
    {
      key: 'client.name',
      label: 'Client',
      sortable: false,
      render: (_val, row) => {
        const client = row.client as { name: string } | undefined;
        return client?.name || '—';
      },
    },
    {
      key: 'items',
      label: 'Articles',
      render: (_val, row) => {
        const items = row.items as Array<{ quantity: number }> | undefined;
        const qty = items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
        return `${qty} article${qty > 1 ? 's' : ''}`;
      },
    },
    {
      key: 'total',
      label: 'Montant',
      sortable: true,
      render: (val) => <span className="font-medium">{formatCurrency(val as number)}</span>,
    },
    {
      key: 'status',
      label: 'Statut',
      render: (val) => <StatusBadge status={val as string} />,
    },
    {
      key: 'trackingNumber',
      label: 'Tracking',
      render: (val) => val ? <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{val as string}</span> : <span className="text-gray-400">—</span>,
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (val) => format(new Date(val as string), 'dd/MM/yyyy HH:mm'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data?.pagination?.total || 0} commandes au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAccess(['president', 'commercial']) && (
            <>
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="btn btn-secondary"
              >
                <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
                Sync Shopify
              </button>
              <button
                onClick={() => syncMetafieldsMutation.mutate()}
                disabled={syncMetafieldsMutation.isPending}
                className="btn btn-secondary"
                title="Importer les metafields et configurations putter depuis Shopify"
              >
                <RefreshCw size={16} className={syncMetafieldsMutation.isPending ? 'animate-spin' : ''} />
                Sync metafields
              </button>
            </>
          )}
          {canAccess(['president', 'commercial']) && (
            <button className="btn btn-primary">
              <Plus size={16} />
              Nouvelle commande
            </button>
          )}
        </div>
      </div>

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
              {ORDER_STATUSES.map((s) => (
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
          pagination={
            data?.pagination
              ? {
                  ...data.pagination,
                  onPageChange: setPage,
                }
              : undefined
          }
          onSort={(key, order) => { setSortBy(key); setSortOrder(order); }}
          sortKey={sortBy}
          sortOrder={sortOrder}
          onRowClick={(row) => navigate(`/orders/${row.id}`)}
          rowKey={(row) => row.id as string}
          emptyMessage="Aucune commande trouvée"
        />
      </div>
    </div>
  );
}
