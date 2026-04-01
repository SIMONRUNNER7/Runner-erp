import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Factory, RefreshCw, Search, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { productionApi } from '../lib/api';

type Row = Record<string, string>;

const COL = {
  date: 'DATE \nCOMMANDE',
  client: 'CLIENT',
  modele: 'MODELE',
  centre: 'CENTRE',
  offset: 'OFFSET',
  main: 'MAIN',
  shaft: 'SHAFT',
  taille: 'TAILLE',
  grip: 'GRIP',
  couleur: 'COULEUR',
  mire: 'MIRE',
  couleurPoids: 'COULEUR\nPOIDS',
  face: 'FACE',
  poids: 'POIDS',
  reglage: 'REGLAGE',
  adresse: 'ADRESSE',
  commande: 'COMMANDE',
  assemblage: 'ASSEMBLAGE',
  expedition: 'EXPEDITION',
  dateExpedition: 'DATE\nEXPEDITION',
  modeExpedition: "Mode d'expédition",
  facturation: 'Facturation',
};

// Normalize column key lookup (handles newlines & case)
function getCol(row: Row, key: string): string {
  if (row[key] !== undefined) return row[key];
  const normalized = key.replace(/\n/g, ' ').toLowerCase();
  const match = Object.keys(row).find(
    (k) => k.replace(/\n/g, ' ').toLowerCase() === normalized
  );
  return match ? row[match] : '';
}

function isChecked(val: string): boolean {
  const v = val?.toLowerCase().trim();
  return v === 'oui' || v === 'x' || v === '✓' || v === 'true' || v === '1' || v === 'yes';
}

type FilterStatus = 'all' | 'todo' | 'in_progress' | 'done';

export default function Production() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    return orders.filter((row) => {
      const client = getCol(row, COL.client).toLowerCase();
      const modele = getCol(row, COL.modele).toLowerCase();
      const commande = getCol(row, COL.commande);
      const q = search.toLowerCase();

      const matchSearch = !search || client.includes(q) || modele.includes(q);

      const assembled = isChecked(getCol(row, COL.assemblage));
      const shipped = isChecked(getCol(row, COL.expedition));
      const ordered = isChecked(commande);

      let matchFilter = true;
      if (filter === 'todo') matchFilter = ordered && !assembled;
      if (filter === 'in_progress') matchFilter = assembled && !shipped;
      if (filter === 'done') matchFilter = shipped;

      return matchSearch && matchFilter;
    });
  }, [orders, search, filter]);

  const stats = useMemo(() => {
    const total = orders.length;
    const todo = orders.filter((r) => isChecked(getCol(r, COL.commande)) && !isChecked(getCol(r, COL.assemblage))).length;
    const inProgress = orders.filter((r) => isChecked(getCol(r, COL.assemblage)) && !isChecked(getCol(r, COL.expedition))).length;
    const done = orders.filter((r) => isChecked(getCol(r, COL.expedition))).length;
    return { total, todo, inProgress, done };
  }, [orders]);

  const toggleCheck = (row: Row, field: string, current: boolean) => {
    const rowIndex = parseInt(row._rowIndex);
    updateMutation.mutate({ row: rowIndex, field, value: current ? '' : 'OUI' });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Factory size={24} className="text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900">Production — Commandes 2025</h1>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['production', 'orders'] })}
          className="btn btn-secondary btn-sm flex items-center gap-2"
        >
          <RefreshCw size={15} />
          Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total lignes', value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'À assembler', value: stats.todo, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Assemblé, à expédier', value: stats.inProgress, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Expédiées', value: stats.done, color: 'text-green-700', bg: 'bg-green-50' },
        ].map((k) => (
          <div key={k.label} className={`card p-5 ${k.bg}`}>
            <p className="text-sm text-gray-500 mb-1">{k.label}</p>
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Rechercher client, modèle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {([
            ['all', 'Toutes'],
            ['todo', 'À assembler'],
            ['in_progress', 'À expédier'],
            ['done', 'Expédiées'],
          ] as [FilterStatus, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === val
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Chargement du Google Sheet...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">
            Erreur de connexion au Google Sheet. Vérifiez les credentials.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Aucune ligne trouvée</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Modèle</th>
                  <th>Main</th>
                  <th>Shaft</th>
                  <th>Taille</th>
                  <th>Grip</th>
                  <th>Couleur</th>
                  <th className="text-center">Commande</th>
                  <th className="text-center">Assemblage</th>
                  <th className="text-center">Expédition</th>
                  <th className="text-center">Facturation</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const rowId = row._rowIndex;
                  const isExpanded = expandedRow === rowId;
                  const assembled = isChecked(getCol(row, COL.assemblage));
                  const shipped = isChecked(getCol(row, COL.expedition));
                  const ordered = isChecked(getCol(row, COL.commande));
                  const billed = isChecked(getCol(row, COL.facturation));

                  return [
                    <tr
                      key={rowId}
                      className={`cursor-pointer ${isExpanded ? 'bg-purple-50' : ''}`}
                      onClick={() => setExpandedRow(isExpanded ? null : rowId)}
                    >
                      <td className="text-xs text-gray-400">{rowId}</td>
                      <td className="text-xs text-gray-500 whitespace-nowrap">
                        {getCol(row, COL.date)}
                      </td>
                      <td className="font-medium">{getCol(row, COL.client)}</td>
                      <td>{getCol(row, COL.modele)}</td>
                      <td>{getCol(row, COL.main)}</td>
                      <td>{getCol(row, COL.shaft)}</td>
                      <td>{getCol(row, COL.taille)}</td>
                      <td className="text-xs">{getCol(row, COL.grip)}</td>
                      <td className="text-xs">{getCol(row, COL.couleur)}</td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <CheckButton
                          checked={ordered}
                          onChange={() => toggleCheck(row, 'COMMANDE', ordered)}
                        />
                      </td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <CheckButton
                          checked={assembled}
                          onChange={() => toggleCheck(row, 'ASSEMBLAGE', assembled)}
                        />
                      </td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <CheckButton
                          checked={shipped}
                          onChange={() => toggleCheck(row, 'EXPEDITION', shipped)}
                        />
                      </td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <CheckButton
                          checked={billed}
                          onChange={() => toggleCheck(row, 'Facturation', billed)}
                        />
                      </td>
                      <td>
                        {isExpanded ? (
                          <ChevronUp size={14} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={14} className="text-gray-400" />
                        )}
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`${rowId}-detail`} className="bg-purple-50">
                        <td colSpan={14} className="px-6 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
                            {[
                              ['Centre', COL.centre],
                              ['Offset', COL.offset],
                              ['Mire', COL.mire],
                              ['Couleur poids', COL.couleurPoids],
                              ['Face', COL.face],
                              ['Poids', COL.poids],
                              ['Réglage', COL.reglage],
                              ["Mode d'expédition", COL.modeExpedition],
                              ["Date expédition", COL.dateExpedition],
                              ['Adresse', COL.adresse],
                            ].map(([label, col]) => {
                              const val = getCol(row, col);
                              if (!val) return null;
                              return (
                                <div key={label}>
                                  <span className="text-xs text-gray-400 block">{label}</span>
                                  <span className="font-medium text-gray-800">{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && (
          <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-500">
            {filtered.length} ligne{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
            {filtered.length !== orders.length && ` sur ${orders.length}`}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckButton({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
        checked
          ? 'text-green-600 hover:bg-green-100'
          : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
      }`}
    >
      {checked ? <CheckCircle2 size={18} /> : <Circle size={18} />}
    </button>
  );
}
