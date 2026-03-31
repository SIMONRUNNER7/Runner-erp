import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Plus, AlertTriangle, Filter } from 'lucide-react';
import { stockApi } from '../lib/api';
import DataTable, { Column } from '../components/DataTable';
import StockLevel from '../components/StockLevel';
import StockChart from '../components/charts/StockChart';
import { useAuth } from '../hooks/useAuth';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

interface AdjustStockForm {
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
}

export default function Stock() {
  const queryClient = useQueryClient();
  const { canAccess } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [adjustForm, setAdjustForm] = useState<AdjustStockForm | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stock', page, search, category, lowStockOnly, sortBy, sortOrder],
    queryFn: () =>
      stockApi.list({ page, limit: 20, search, category, lowStock: lowStockOnly, sortBy, sortOrder }).then((r) => r.data),
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => stockApi.lowStock().then((r) => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: () => stockApi.syncSheets(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock'] }),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => stockApi.adjust(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      setAdjustForm(null);
    },
  });

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: 'name',
      label: 'Produit',
      sortable: true,
      render: (val, row) => (
        <div>
          <p className="font-medium">{val as string}</p>
          <p className="text-xs text-gray-400 font-mono">{row.sku as string}</p>
        </div>
      ),
    },
    { key: 'category', label: 'Catégorie', render: (val) => val ? <span className="badge bg-gray-100 text-gray-700">{val as string}</span> : '—' },
    {
      key: 'stock',
      label: 'Stock',
      sortable: true,
      render: (val, row) => (
        <StockLevel
          stock={val as number}
          minStock={row.minStock as number}
          className="min-w-[120px]"
        />
      ),
    },
    {
      key: 'price',
      label: 'Prix vente',
      sortable: true,
      render: (val) => formatCurrency(val as number),
    },
    {
      key: 'cost',
      label: 'Prix coût',
      sortable: true,
      render: (val) => formatCurrency(val as number),
    },
    {
      key: 'supplyDays',
      label: 'Délai appro.',
      render: (val) => `${val} j`,
    },
    ...(canAccess(['president', 'production', 'achats'])
      ? [{
          key: 'id',
          label: 'Actions',
          render: (_val: unknown, row: Record<string, unknown>) => (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAdjustForm({
                  productId: row.id as string,
                  productName: row.name as string,
                  type: 'adjustment',
                  quantity: 0,
                  reason: '',
                });
              }}
              className="btn btn-secondary btn-sm"
            >
              Ajuster
            </button>
          ),
        }]
      : []),
  ];

  const lowAlertCount = lowStockData?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion du stock</h1>
          <p className="text-gray-500 text-sm mt-1">
            {data?.pagination?.total || 0} produits
            {lowAlertCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">
                · {lowAlertCount} en stock bas
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAccess(['president', 'production', 'achats']) && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="btn btn-secondary"
            >
              <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
              Sync Google Sheets
            </button>
          )}
          {canAccess(['president', 'production', 'achats']) && (
            <button className="btn btn-primary">
              <Plus size={16} />
              Nouveau produit
            </button>
          )}
        </div>
      </div>

      {/* Low stock alert banner */}
      {lowAlertCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-orange-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-orange-800">
              {lowAlertCount} produit{lowAlertCount > 1 ? 's' : ''} en stock bas
            </p>
            <p className="text-sm text-orange-600">
              Ces produits nécessitent un réapprovisionnement urgent.
            </p>
          </div>
          <button
            onClick={() => setLowStockOnly(true)}
            className="ml-auto btn btn-sm bg-orange-500 text-white hover:bg-orange-600"
          >
            Voir seulement
          </button>
        </div>
      )}

      {/* Stock chart */}
      {!lowStockOnly && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Niveaux de stock (top produits)</h3>
          <StockChart
            data={(data?.data || []).map((p: { name: string; stock: number; minStock: number }) => ({
              name: p.name,
              stock: p.stock,
              minStock: p.minStock,
            }))}
          />
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
              placeholder="Rechercher par nom, SKU..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <input
              type="text"
              className="input w-auto"
              placeholder="Catégorie..."
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded"
            />
            <span>Stock bas seulement</span>
          </label>
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
              ? { ...data.pagination, onPageChange: setPage }
              : undefined
          }
          onSort={(key, order) => { setSortBy(key); setSortOrder(order); }}
          sortKey={sortBy}
          sortOrder={sortOrder}
          rowKey={(row) => row.id as string}
          emptyMessage="Aucun produit trouvé"
        />
      </div>

      {/* Adjust stock modal */}
      {adjustForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">
              Ajuster le stock: {adjustForm.productName}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Type de mouvement</label>
                <select
                  className="input"
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as 'in' | 'out' | 'adjustment' })}
                >
                  <option value="in">Entrée</option>
                  <option value="out">Sortie</option>
                  <option value="adjustment">Ajustement</option>
                </select>
              </div>
              <div>
                <label className="label">Quantité</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Raison</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: Inventaire, retour client..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setAdjustForm(null)}
                className="btn btn-secondary flex-1 justify-center"
              >
                Annuler
              </button>
              <button
                onClick={() => adjustMutation.mutate({
                  id: adjustForm.productId,
                  data: { type: adjustForm.type, quantity: adjustForm.quantity, reason: adjustForm.reason },
                })}
                disabled={adjustMutation.isPending || !adjustForm.reason || adjustForm.quantity <= 0}
                className="btn btn-primary flex-1 justify-center"
              >
                {adjustMutation.isPending ? 'Sauvegarde...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
