import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ShoppingCart, DollarSign } from 'lucide-react';
import { clientsApi } from '../lib/api';
import DataTable, { Column } from '../components/DataTable';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

export default function Clients() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, search, sortBy, sortOrder],
    queryFn: () =>
      clientsApi.list({ page, limit: 20, search, sortBy, sortOrder }).then((r) => r.data),
  });

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'name',
      label: 'Nom',
      sortable: true,
      render: (val) => <span className="font-medium">{val as string}</span>,
    },
    { key: 'email', label: 'Email', render: (val) => val ? <a href={`mailto:${val}`} className="text-blue-600 hover:underline">{val as string}</a> : '—' },
    { key: 'phone', label: 'Téléphone', render: (val) => (val as string) || '—' },
    { key: 'city', label: 'Ville', render: (val) => (val as string) || '—' },
    {
      key: '_count',
      label: 'Commandes',
      render: (_val, row) => {
        const count = row._count as { orders?: number; invoices?: number } | undefined;
        return (
          <div className="flex items-center gap-1">
            <ShoppingCart size={14} className="text-gray-400" />
            <span>{count?.orders || 0}</span>
          </div>
        );
      },
    },
    {
      key: 'totalRevenue',
      label: 'CA total',
      sortable: true,
      render: (val) => <span className="font-medium">{formatCurrency(val as number)}</span>,
    },
    {
      key: 'createdAt',
      label: 'Client depuis',
      sortable: true,
      render: (val) => new Date(val as string).getFullYear().toString(),
    },
  ];

  const totalRevenue = data?.data?.reduce((sum: number, c: { totalRevenue: number }) => sum + (c.totalRevenue || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.pagination?.total || 0} clients</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{data?.pagination?.total || 0}</p>
            <p className="text-sm text-gray-500">Clients totaux</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <DollarSign size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
            <p className="text-sm text-gray-500">CA total clients</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <ShoppingCart size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {data?.data
                ? Math.round(
                    data.data.reduce((sum: number, c: { _count?: { orders?: number } }) => sum + (c._count?.orders || 0), 0) /
                      Math.max(data.data.length, 1)
                  )
                : 0}
            </p>
            <p className="text-sm text-gray-500">Commandes moy. / client</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Rechercher par nom, email, téléphone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
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
          onRowClick={(row) => navigate(`/clients/${row.id}`)}
          rowKey={(row) => row.id as string}
          emptyMessage="Aucun client trouvé"
        />
      </div>
    </div>
  );
}
