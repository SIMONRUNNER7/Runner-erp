import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Factory, RefreshCw, Search, CheckCircle2, Circle,
  X, Download, ChevronRight, PackageCheck, AlertTriangle, Wrench, Loader2
} from 'lucide-react';
import { productionApi } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

interface BOMItem {
  sku: string;
  name: string;
  qty: number;
  category: string;
  stock: number | null;
  available: boolean;
}

type Row = Record<string, string>;

// Normalize column key (handles newlines & case variants)
function get(row: Row, key: string): string {
  if (row[key] !== undefined) return row[key];
  const norm = key.replace(/\n/g, ' ').toLowerCase().trim();
  const match = Object.keys(row).find(
    (k) => k.replace(/\n/g, ' ').toLowerCase().trim() === norm
  );
  return match ? row[match] : '';
}

function isChecked(val: string): boolean {
  const v = val?.toLowerCase().trim();
  return v === 'oui' || v === 'x' || v === '✓' || v === 'true' || v === '1' || v === 'yes';
}

type FilterStatus = 'all' | 'todo' | 'in_progress' | 'done';

const SPECS: [string, string][] = [
  ['Modèle', 'MODELE'],
  ['Centre', 'CENTRE'],
  ['Offset', 'OFFSET'],
  ['Main', 'MAIN'],
  ['Shaft', 'SHAFT'],
  ['Taille', 'TAILLE'],
  ['Grip', 'GRIP'],
  ['Couleur', 'COULEUR'],
  ['Mire', 'MIRE'],
  ['Couleur poids', 'COULEUR\nPOIDS'],
  ['Face', 'FACE'],
  ['Poids', 'POIDS'],
  ['Réglage', 'REGLAGE'],
  ['Adresse', 'ADRESSE'],
  ["Mode d'expédition", "Mode d'expédition"],
  ['Date expédition', 'DATE\nEXPEDITION'],
];

export default function Production() {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selected, setSelected] = useState<Row | null>(null);

  const { data: orders = [], isLoading, error } = useQuery<Row[]>({
    queryKey: ['production', 'orders'],
    queryFn: () => productionApi.orders().then((r) => r.data),
    staleTime: 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ row, field, value }: { row: number; field: string; value: string }) =>
      productionApi.updateRow(row, field, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['production', 'orders'] }),
  });

  const toggleCheck = (e: React.MouseEvent, row: Row, field: string, current: boolean) => {
    e.stopPropagation();
    updateMutation.mutate({ row: parseInt(row._rowIndex), field, value: current ? '' : 'OUI' });
  };

  const filtered = useMemo(() => {
    return orders.filter((row) => {
      const ref = get(row, 'COMMANDE').toLowerCase();
      const client = get(row, 'CLIENT').toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !search || ref.includes(q) || client.includes(q);

      const assembled = isChecked(get(row, 'ASSEMBLAGE'));
      const shipped = isChecked(get(row, 'EXPEDITION'));
      const ordered = isChecked(get(row, 'COMMANDE'));

      let matchFilter = true;
      if (filter === 'todo') matchFilter = ordered && !assembled;
      if (filter === 'in_progress') matchFilter = assembled && !shipped;
      if (filter === 'done') matchFilter = shipped;

      return matchSearch && matchFilter;
    });
  }, [orders, search, filter]);

  const stats = useMemo(() => ({
    total: orders.length,
    todo: orders.filter((r) => isChecked(get(r, 'COMMANDE')) && !isChecked(get(r, 'ASSEMBLAGE'))).length,
    inProgress: orders.filter((r) => isChecked(get(r, 'ASSEMBLAGE')) && !isChecked(get(r, 'EXPEDITION'))).length,
    done: orders.filter((r) => isChecked(get(r, 'EXPEDITION'))).length,
  }), [orders]);

  const handleDownloadPdf = (row: Row) => {
    const rowIndex = parseInt(row._rowIndex);
    const url = productionApi.pdfUrl(rowIndex);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('Authorization', `Bearer ${token}`);
    // Use fetch with auth header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `fiche-production-${get(row, 'COMMANDE') || rowIndex}.pdf`;
        link.click();
        URL.revokeObjectURL(blobUrl);
      });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Factory size={20} className="text-purple-600 shrink-0" />
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Production 2025</h1>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['production', 'orders'] })}
          className="btn btn-secondary btn-sm flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Actualiser</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50', filter: 'all' },
          { label: 'À assembler', value: stats.todo, color: 'text-blue-700', bg: 'bg-blue-50', filter: 'todo' },
          { label: 'À expédier', value: stats.inProgress, color: 'text-purple-700', bg: 'bg-purple-50', filter: 'in_progress' },
          { label: 'Expédiées', value: stats.done, color: 'text-green-700', bg: 'bg-green-50', filter: 'done' },
        ].map((k) => (
          <button
            key={k.label}
            onClick={() => setFilter(k.filter as FilterStatus)}
            className={`card p-3 sm:p-5 text-left transition-all ${k.bg} ${filter === k.filter ? 'ring-2 ring-purple-400' : 'hover:shadow-md'}`}
          >
            <p className="text-xs sm:text-sm text-gray-500 mb-1 leading-tight">{k.label}</p>
            <p className={`text-2xl sm:text-3xl font-bold ${k.color}`}>{k.value}</p>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="card p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Ref. commande, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([['all', 'Toutes'], ['todo', 'À assembler'], ['in_progress', 'À expédier'], ['done', 'Expédiées']] as [FilterStatus, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${filter === val ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Chargement...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">Erreur de connexion au Google Sheet.</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Aucune commande trouvée</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Desktop header (hidden on mobile) */}
            <div className="hidden sm:grid grid-cols-[1fr_140px_100px_80px_80px_32px] gap-4 px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Référence / Client</span>
              <span>Date</span>
              <span>Modèle</span>
              <span className="text-center">Assemblage</span>
              <span className="text-center">Expédition</span>
              <span />
            </div>

            {filtered.map((row) => {
              const ref = get(row, 'COMMANDE');
              const client = get(row, 'CLIENT');
              const date = get(row, 'DATE \nCOMMANDE') || get(row, 'DATE COMMANDE') || get(row, 'DATE\nCOMMANDE');
              const modele = get(row, 'MODELE');
              const assembled = isChecked(get(row, 'ASSEMBLAGE'));
              const shipped = isChecked(get(row, 'EXPEDITION'));

              return (
                <div key={row._rowIndex} onClick={() => setSelected(row)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                  {/* Desktop row */}
                  <div className="hidden sm:grid grid-cols-[1fr_140px_100px_80px_80px_32px] gap-4 px-6 py-4 items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{ref || '—'}</p>
                      <p className="text-sm text-gray-500">{client}</p>
                    </div>
                    <span className="text-sm text-gray-600">{date}</span>
                    <span className="text-sm text-gray-700 truncate">{modele}</span>
                    <div className="flex justify-center" onClick={(e) => toggleCheck(e, row, 'ASSEMBLAGE', assembled)}>
                      {assembled ? <CheckCircle2 size={20} className="text-green-500" /> : <Circle size={20} className="text-gray-300 hover:text-gray-400" />}
                    </div>
                    <div className="flex justify-center" onClick={(e) => toggleCheck(e, row, 'EXPEDITION', shipped)}>
                      {shipped ? <CheckCircle2 size={20} className="text-cyan-500" /> : <Circle size={20} className="text-gray-300 hover:text-gray-400" />}
                    </div>
                    <ChevronRight size={16} className="text-gray-400" />
                  </div>

                  {/* Mobile row */}
                  <div className="sm:hidden flex items-center gap-2 px-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-snug">{ref || '—'}</p>
                      <p className="text-xs text-gray-500 truncate">{client}{modele ? ` · ${modele}` : ''}</p>
                      {date && <p className="text-xs text-gray-400">{date}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div onClick={(e) => toggleCheck(e, row, 'ASSEMBLAGE', assembled)} className="p-1">
                        {assembled ? <CheckCircle2 size={22} className="text-green-500" /> : <Circle size={22} className="text-gray-300" />}
                      </div>
                      <div onClick={(e) => toggleCheck(e, row, 'EXPEDITION', shipped)} className="p-1">
                        {shipped ? <CheckCircle2 size={22} className="text-cyan-500" /> : <Circle size={22} className="text-gray-300" />}
                      </div>
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-400">
            {filtered.length} commande{filtered.length > 1 ? 's' : ''}{filtered.length !== orders.length ? ` sur ${orders.length}` : ''}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          row={selected}
          onClose={() => setSelected(null)}
          onToggle={(field, current) =>
            updateMutation.mutate({ row: parseInt(selected._rowIndex), field, value: current ? '' : 'OUI' })
          }
          onDownload={() => handleDownloadPdf(selected)}
        />
      )}
    </div>
  );
}

function DetailPanel({
  row, onClose, onToggle, onDownload
}: {
  row: Row;
  onClose: () => void;
  onToggle: (field: string, current: boolean) => void;
  onDownload: () => void;
}) {
  const queryClient = useQueryClient();
  const ref = get(row, 'COMMANDE');
  const client = get(row, 'CLIENT');
  const date = get(row, 'DATE \nCOMMANDE') || get(row, 'DATE COMMANDE') || get(row, 'DATE\nCOMMANDE');
  const assembled = isChecked(get(row, 'ASSEMBLAGE'));
  const shipped = isChecked(get(row, 'EXPEDITION'));
  const billed = isChecked(get(row, 'Facturation'));

  const rowIndex = parseInt(row._rowIndex);

  const { data: bomData, isLoading: bomLoading } = useQuery<{ bom: BOMItem[]; canProduce: boolean }>({
    queryKey: ['production', 'bom', rowIndex],
    queryFn: () => productionApi.bom(rowIndex).then((r) => r.data),
    staleTime: 30_000,
  });

  const consumeMutation = useMutation({
    mutationFn: () => productionApi.consume(rowIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', 'orders'] });
      queryClient.invalidateQueries({ queryKey: ['production', 'bom', rowIndex] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" />

      {/* Panel */}
      <div
        className="w-full sm:max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Fiche de production</p>
            <h2 className="text-xl font-bold text-gray-900">{ref || `Ligne ${row._rowIndex}`}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Client + date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Client</p>
              <p className="font-semibold text-gray-900">{client || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Date commande</p>
              <p className="font-semibold text-gray-900">{date || '—'}</p>
            </div>
          </div>

          {/* Statuts */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Statuts</p>
            <div className="space-y-2">
              {([
                ['ASSEMBLAGE', 'Assemblage', assembled, 'text-green-600'],
                ['EXPEDITION', 'Expédition', shipped, 'text-cyan-600'],
                ['Facturation', 'Facturation', billed, 'text-blue-600'],
              ] as [string, string, boolean, string][]).map(([field, label, checked, color]) => (
                <button
                  key={field}
                  onClick={() => onToggle(field, checked)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                    checked ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {checked
                    ? <CheckCircle2 size={20} className={color} />
                    : <Circle size={20} className="text-gray-300" />}
                  <span className={`font-medium ${checked ? color : 'text-gray-500'}`}>{label}</span>
                  <span className="ml-auto text-xs text-gray-400">{checked ? 'Fait' : 'En attente'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Specs */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Spécifications</p>
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-200">
              {SPECS.map(([label, col]) => {
                const val = get(row, col);
                if (!val) return null;
                return (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-gray-500">{label}</span>
                    <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%]">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BOM / Recette */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Composants</p>
            {bomLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <Loader2 size={16} className="animate-spin" />
                Calcul de la recette...
              </div>
            ) : bomData ? (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
                  bomData.canProduce ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {bomData.canProduce
                    ? <PackageCheck size={16} />
                    : <AlertTriangle size={16} />}
                  {bomData.canProduce ? 'Stock disponible pour produire' : 'Stock insuffisant'}
                </div>
                <div className="bg-gray-50 rounded-xl divide-y divide-gray-200">
                  {bomData.bom.map((item) => (
                    <div key={item.sku} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.sku} · ×{item.qty}</p>
                      </div>
                      <div className={`ml-3 text-xs font-semibold px-2 py-1 rounded-lg ${
                        item.stock === null
                          ? 'bg-gray-100 text-gray-400'
                          : item.available
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {item.stock === null ? 'N/A' : `${item.stock} en stock`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white space-y-2">
          {!assembled && bomData && (
            <button
              onClick={() => consumeMutation.mutate()}
              disabled={consumeMutation.isPending || !bomData.canProduce}
              className="btn w-full flex items-center justify-center gap-2 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {consumeMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wrench size={16} />
              )}
              {consumeMutation.isPending ? 'Assemblage en cours...' : 'Marquer assemblé + déduire stock'}
            </button>
          )}
          <button
            onClick={onDownload}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Télécharger la fiche de production
          </button>
        </div>
      </div>
    </div>
  );
}
