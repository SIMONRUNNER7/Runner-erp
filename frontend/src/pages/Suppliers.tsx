import { useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Star, Clock } from 'lucide-react';
import { suppliersApi } from '../lib/api';
import DataTable, { Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';

export default function Suppliers() {
  const queryClient = useQueryClient();
  const { canAccess } = useAuth();

  const [tab, setTab] = useState<'suppliers' | 'purchase-orders'>('suppliers');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [poStatus, setPoStatus] = useState('');

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => suppliersApi.list({ page, limit: 20, search }).then((r) => r.data),
    enabled: tab === 'suppliers',
  });

  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ['purchase-orders', page, poStatus],
    queryFn: () => suppliersApi.purchaseOrders({ page, limit: 20, status: poStatus }).then((r) => r.data),
    enabled: tab === 'purchase-orders',
  });

  const updatePoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => suppliersApi.updatePO(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });

  const supplierColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'name',
      label: 'Fournisseur',
      sortable: true,
      render: (val: unknown, row: Record<string, unknown>): ReactNode => (
        <div>
          <p className="font-medium">{val as string}</p>
          {!!row.contactName && <p className="text-xs text-gray-400">{String(row.contactName)}</p>}
        </div>
      ),
    },
    { key: 'email', label: 'Email', render: (val) => val ? <a href={`mailto:${val}`} className="text-blue-600 text-sm">{val as string}</a> : '—' },
    {
      key: 'avgDeliveryDays',
      label: 'Délai livraison',
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-1">
          <Clock size={14} className="text-gray-400" />
          <span>{val as number} jours</span>
        </div>
      ),
    },
    {
      key: 'rating',
      label: 'Note',
      sortable: true,
      render: (val) => {
        const rating = val as number;
        return (
          <div className="flex items-center gap-1">
            <Star size={14} className={rating >= 3 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
            <span className="text-sm">{rating > 0 ? rating.toFixed(1) : 'N/A'}</span>
          </div>
        );
      },
    },
    {
      key: '_count',
      label: 'Produits',
      render: (_val, row) => {
        const count = row._count as { products?: number; purchaseOrders?: number } | undefined;
        return (
          <div className="text-sm">
            <span>{count?.products || 0} produits</span>
            <span className="text-gray-400 ml-1">· {count?.purchaseOrders || 0} BCs</span>
          </div>
        );
      },
    },
  ];

  const poColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'id',
      label: 'N° BC',
      render: (val) => <span className="font-mono text-sm">#{(val as string).slice(0, 8)}</span>,
    },
    {
      key: 'supplier',
      label: 'Fournisseur',
      render: (val) => {
        const s = val as { name: string } | undefined;
        return s?.name || '—';
      },
    },
    {
      key: 'items',
      label: 'Articles',
      render: (val) => {
        const items = val as Array<{ quantity: number; product?: { name: string } }> | undefined;
        const count = items?.length || 0;
        return `${count} référence${count > 1 ? 's' : ''}`;
      },
    },
    {
      key: 'total',
      label: 'Total',
      render: (val) => (
        <span className="font-medium">
          {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val as number)}
        </span>
      ),
    },
    { key: 'status', label: 'Statut', render: (val) => <StatusBadge status={val as string} /> },
    {
      key: 'expectedDate',
      label: 'Date attendue',
      render: (val) => val ? format(new Date(val as string), 'dd/MM/yyyy') : '—',
    },
    {
      key: 'createdAt',
      label: 'Créé le',
      render: (val) => format(new Date(val as string), 'dd/MM/yyyy'),
    },
    ...(canAccess(['president', 'achats'])
      ? [{
          key: 'id',
          label: 'Actions',
          render: (val: unknown, row: Record<string, unknown>) => (
            <div className="flex gap-1">
              {row.status === 'draft' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePoMutation.mutate({ id: val as string, data: { status: 'sent' } });
                  }}
                  className="btn btn-sm btn-primary"
                >
                  Envoyer
                </button>
              )}
              {row.status === 'confirmed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updatePoMutation.mutate({ id: val as string, data: { status: 'received', receivedDate: new Date().toISOString() } });
                  }}
                  className="btn btn-sm bg-green-500 text-white hover:bg-green-600"
                >
                  Reçu
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
          <h1 className="text-2xl font-bold text-gray-900">Fournisseurs</h1>
          <p className="text-gray-500 text-sm mt-1">Gestion des fournisseurs et bons de commande</p>
        </div>
        {canAccess(['president', 'achats']) && (
          <button className="btn btn-primary">
            <Plus size={16} />
            {tab === 'suppliers' ? 'Nouveau fournisseur' : 'Nouveau BC'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('suppliers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'suppliers' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Fournisseurs
        </button>
        <button
          onClick={() => setTab('purchase-orders')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            tab === 'purchase-orders' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Bons de commande
        </button>
      </div>

      {tab === 'suppliers' && (
        <>
          <div className="card p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="input pl-9"
                placeholder="Rechercher un fournisseur..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
          <div className="card">
            <DataTable
              columns={supplierColumns}
              data={(suppliersData?.data || []) as Record<string, unknown>[]}
              loading={suppliersLoading}
              pagination={suppliersData?.pagination ? { ...suppliersData.pagination, onPageChange: setPage } : undefined}
              rowKey={(row) => row.id as string}
              emptyMessage="Aucun fournisseur trouvé"
            />
          </div>
        </>
      )}

      {tab === 'purchase-orders' && (
        <>
          <div className="card p-4">
            <div className="flex gap-3">
              <select
                className="input w-auto"
                value={poStatus}
                onChange={(e) => { setPoStatus(e.target.value); setPage(1); }}
              >
                <option value="">Tous les statuts</option>
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyé</option>
                <option value="confirmed">Confirmé</option>
                <option value="received">Reçu</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>
          <div className="card">
            <DataTable
              columns={poColumns}
              data={(poData?.data || []) as Record<string, unknown>[]}
              loading={poLoading}
              pagination={poData?.pagination ? { ...poData.pagination, onPageChange: setPage } : undefined}
              rowKey={(row) => row.id as string}
              emptyMessage="Aucun bon de commande trouvé"
            />
          </div>
        </>
      )}
    </div>
  );
}
