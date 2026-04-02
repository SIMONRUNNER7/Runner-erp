import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, AlertTriangle, Loader2, Package } from 'lucide-react';
import { componentsApi, suppliersApi } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = [
  'arriere', 'centre', 'face', 'mire', 'poids', 'shaft', 'grip',
  'cover', 'hardware', 'visserie', 'consommable', 'emballage',
];

const CATEGORY_LABELS: Record<string, string> = {
  arriere:    'Pièce arrière',
  centre:     'Centre',
  face:       'Face',
  mire:       'Mire',
  poids:      'Poids',
  shaft:      'Shaft',
  grip:       'Grip',
  cover:      'Cover',
  hardware:   'Quincaillerie',
  visserie:   'Visserie',
  consommable:'Consommable',
  emballage:  'Emballage',
};

interface Component {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unitCost: number;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface AdjustForm {
  componentId: string;
  componentName: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
}

interface EditForm {
  componentId: string;
  minStock: number;
  unitCost: number;
  supplierId: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

export default function Stock() {
  const queryClient = useQueryClient();
  const { canAccess } = useAuth();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [adjustForm, setAdjustForm] = useState<AdjustForm | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const { data: components = [], isLoading } = useQuery<Component[]>({
    queryKey: ['components'],
    queryFn: () => componentsApi.list().then((r) => r.data),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.list().then((r) => r.data?.data || r.data),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      componentsApi.adjust(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setAdjustForm(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      componentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setEditForm(null);
    },
  });

  const filtered = components.filter((c) => {
    if (lowStockOnly && c.stock >= c.minStock) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (supplierFilter && c.supplierId !== supplierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.sku.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const lowCount = components.filter((c) => c.stock < c.minStock).length;
  const totalValue = components.reduce((sum, c) => sum + c.stock * c.unitCost, 0);

  const canEdit = canAccess(['president', 'production', 'achats']);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock composants</h1>
          <p className="text-sm text-gray-500 mt-1">
            {components.length} composants
            {lowCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">· {lowCount} en stock bas</span>
            )}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total composants</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{components.length}</p>
        </div>
        <div
          className={`card p-5 cursor-pointer transition-colors ${lowStockOnly ? 'ring-2 ring-orange-400' : ''}`}
          onClick={() => setLowStockOnly((v) => !v)}
        >
          <p className="text-xs text-gray-400 uppercase tracking-wide">Stock bas</p>
          <p className={`text-2xl font-bold mt-1 ${lowCount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {lowCount}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Valeur stock</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalValue)}</p>
        </div>
      </div>

      {/* Low stock banner */}
      {lowCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-orange-500 flex-shrink-0" />
          <p className="text-sm font-medium text-orange-800">
            {lowCount} composant{lowCount > 1 ? 's' : ''} sous le seuil minimum — réapprovisionnement requis.
          </p>
          <button
            onClick={() => setLowStockOnly(true)}
            className="ml-auto btn btn-sm bg-orange-500 text-white hover:bg-orange-600"
          >
            Voir seulement
          </button>
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
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Toutes catégories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">Tous fournisseurs</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {(search || categoryFilter || supplierFilter || lowStockOnly) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearch(''); setCategoryFilter(''); setSupplierFilter(''); setLowStockOnly(false); }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Table / Cards */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 size={20} className="animate-spin" />
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
            <Package size={32} />
            Aucun composant trouvé
          </div>
        ) : (
          <>
            {/* ── Desktop table ── */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">SKU / Nom</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Catégorie</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fournisseur</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Stock</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Min</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Coût unit.</th>
                  {canEdit && <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => {
                  const isLow = c.stock < c.minStock;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{c.sku}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-gray-100 text-gray-700">{CATEGORY_LABELS[c.category] || c.category}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.supplier?.name || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${isLow ? 'text-orange-600' : 'text-gray-900'}`}>{c.stock}</span>
                        {isLow && <AlertTriangle size={13} className="inline ml-1 text-orange-400" />}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{c.minStock}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {c.unitCost > 0 ? formatCurrency(c.unitCost) : <span className="text-gray-300">—</span>}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => setAdjustForm({ componentId: c.id, componentName: c.name, type: 'in', quantity: 0, reason: '' })}>Ajuster</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditForm({ componentId: c.id, minStock: c.minStock, unitCost: c.unitCost, supplierId: c.supplierId || '' })}>Éditer</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── Mobile cards ── */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filtered.map((c) => {
                const isLow = c.stock < c.minStock;
                return (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm truncate">{c.name}</p>
                        {isLow && <AlertTriangle size={13} className="text-orange-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-400 font-mono">{c.sku}</span>
                        <span className="badge bg-gray-100 text-gray-600 text-xs">{CATEGORY_LABELS[c.category] || c.category}</span>
                        {c.supplier && <span className="text-xs text-gray-500">{c.supplier.name}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-lg leading-none ${isLow ? 'text-orange-600' : 'text-gray-900'}`}>{c.stock}</p>
                      <p className="text-xs text-gray-400 mt-0.5">min {c.minStock}</p>
                    </div>
                    {canEdit && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button className="btn btn-secondary btn-sm text-xs py-1" onClick={() => setAdjustForm({ componentId: c.id, componentName: c.name, type: 'in', quantity: 0, reason: '' })}>+/−</button>
                        <button className="btn btn-secondary btn-sm text-xs py-1" onClick={() => setEditForm({ componentId: c.id, minStock: c.minStock, unitCost: c.unitCost, supplierId: c.supplierId || '' })}>✎</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Adjust stock modal */}
      {adjustForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">
              Ajuster le stock: {adjustForm.componentName}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Type de mouvement</label>
                <select
                  className="input"
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value as 'in' | 'out' | 'adjustment' })}
                >
                  <option value="in">Entrée (+)</option>
                  <option value="out">Sortie (−)</option>
                  <option value="adjustment">Ajustement (valeur absolue)</option>
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
                  placeholder="Ex: Réception fournisseur, inventaire..."
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
                  id: adjustForm.componentId,
                  data: { type: adjustForm.type, quantity: adjustForm.quantity, reason: adjustForm.reason },
                })}
                disabled={adjustMutation.isPending || !adjustForm.reason || adjustForm.quantity <= 0}
                className="btn btn-primary flex-1 justify-center"
              >
                {adjustMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin mr-1" />Sauvegarde...</>
                  : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit component modal */}
      {editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">Modifier le composant</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Fournisseur</label>
                <select
                  className="input"
                  value={editForm.supplierId}
                  onChange={(e) => setEditForm({ ...editForm, supplierId: e.target.value })}
                >
                  <option value="">— Aucun —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Stock minimum</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  value={editForm.minStock}
                  onChange={(e) => setEditForm({ ...editForm, minStock: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Coût unitaire (€)</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="0.01"
                  value={editForm.unitCost}
                  onChange={(e) => setEditForm({ ...editForm, unitCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditForm(null)} className="btn btn-secondary flex-1 justify-center">
                Annuler
              </button>
              <button
                onClick={() => updateMutation.mutate({
                  id: editForm.componentId,
                  data: {
                    minStock: editForm.minStock,
                    unitCost: editForm.unitCost,
                    supplierId: editForm.supplierId || null,
                  },
                })}
                disabled={updateMutation.isPending}
                className="btn btn-primary flex-1 justify-center"
              >
                {updateMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin mr-1" />Sauvegarde...</>
                  : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
