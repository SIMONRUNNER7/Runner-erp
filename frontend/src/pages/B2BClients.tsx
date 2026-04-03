import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { b2bAdminApi } from '../lib/api';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';

interface B2BClient {
  id: string;
  email: string;
  name: string;
  company: string;
  phone?: string;
  discount: number;
  approved: boolean;
  active: boolean;
  notes?: string;
  shopifyCustomerId?: string;
  createdAt: string;
  _count?: { orders: number };
}

const DISCOUNT_TIERS = [0, 5, 10, 15, 20];

const emptyForm = { email: '', password: '', name: '', company: '', phone: '', discount: 0, notes: '' };

export default function B2BClients() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<B2BClient | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'pending'>('active');
  const [error, setError] = useState('');

  const { data: clients = [], isLoading } = useQuery<B2BClient[]>({
    queryKey: ['b2b-clients'],
    queryFn: () => b2bAdminApi.listClients().then((r) => r.data),
  });

  const activeClients = clients.filter((c) => c.approved && c.active);
  const pendingClients = clients.filter((c) => !c.approved);

  const createMutation = useMutation({
    mutationFn: (data: object) => b2bAdminApi.createClient(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['b2b-clients'] }); closeModal(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erreur lors de la création');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => b2bAdminApi.updateClient(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['b2b-clients'] }); closeModal(); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Erreur lors de la mise à jour');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => b2bAdminApi.deleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['b2b-clients'] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => b2bAdminApi.updateClient(id, { approved: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['b2b-clients'] }),
  });

  function openCreate() {
    setForm({ ...emptyForm });
    setError('');
    setModal('create');
  }

  function openEdit(client: B2BClient) {
    setEditing(client);
    setForm({ email: client.email, password: '', name: client.name, company: client.company, phone: client.phone || '', discount: client.discount, notes: client.notes || '' });
    setError('');
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditing(null);
    setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload: Record<string, unknown> = { ...form };
    if (!payload.password) delete payload.password;
    if (modal === 'create') {
      createMutation.mutate(payload);
    } else if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    }
  }

  const shown = tab === 'active' ? activeClients : pendingClients;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clients B2B</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activeClients.length} actifs · {pendingClients.length} en attente</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Nouveau client
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['active', 'pending'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'active' ? 'Actifs' : 'En attente'}{t === 'pending' && pendingClients.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingClients.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Table desktop */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : shown.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucun client {tab === 'pending' ? 'en attente' : 'actif'}</div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Société</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Remise</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Commandes</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Shopify</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((client) => (
                  <tr key={client.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{client.company}</td>
                    <td className="px-4 py-3 text-gray-600">{client.name}</td>
                    <td className="px-4 py-3 text-gray-500">{client.email}</td>
                    <td className="px-4 py-3 text-center">
                      {client.discount > 0 ? (
                        <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">−{client.discount}%</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Standard</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{client._count?.orders ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {client.shopifyCustomerId ? (
                        <CheckCircle size={16} className="text-green-500 mx-auto" />
                      ) : (
                        <XCircle size={16} className="text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!client.approved && (
                          <button
                            onClick={() => approveMutation.mutate(client.id)}
                            className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-md hover:bg-green-700 transition-colors"
                          >
                            Approuver
                          </button>
                        )}
                        <button onClick={() => openEdit(client)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`Supprimer ${client.company} ?`)) deleteMutation.mutate(client.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {shown.map((client) => {
              const expanded = expandedId === client.id;
              return (
                <div key={client.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{client.company}</p>
                      <p className="text-sm text-gray-500">{client.name} · {client.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {client.discount > 0 && (
                        <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">−{client.discount}%</span>
                      )}
                      <button onClick={() => setExpandedId(expanded ? null : client.id)} className="p-1 text-gray-400">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Shopify:</span>
                        {client.shopifyCustomerId ? (
                          <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12} /> Synchronisé</span>
                        ) : (
                          <span className="text-xs text-gray-400 flex items-center gap-1"><XCircle size={12} /> Non synchronisé</span>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        {!client.approved && (
                          <button onClick={() => approveMutation.mutate(client.id)} className="flex-1 text-xs bg-green-600 text-white py-1.5 rounded-md">Approuver</button>
                        )}
                        <button onClick={() => openEdit(client)} className="flex-1 text-xs border border-gray-200 py-1.5 rounded-md text-gray-600">Modifier</button>
                        <button
                          onClick={() => { if (window.confirm(`Supprimer ${client.company} ?`)) deleteMutation.mutate(client.id); }}
                          className="px-3 text-xs border border-red-200 text-red-500 py-1.5 rounded-md"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {modal === 'create' ? 'Nouveau client B2B' : `Modifier — ${editing?.company}`}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Société *</label>
                  <input className="input w-full" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Runner Golf Paris" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nom *</label>
                  <input className="input w-full" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jean Dupont" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Téléphone</label>
                  <input className="input w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+33 6 12 34 56 78" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                  <input className="input w-full" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@boutique.fr" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {modal === 'edit' ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}
                  </label>
                  <input
                    className="input w-full"
                    type="password"
                    autoComplete="new-password"
                    required={modal === 'create'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={modal === 'edit' ? '••••••••' : 'Min. 8 caractères'}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Remise supplémentaire</label>
                  <div className="flex gap-2">
                    {DISCOUNT_TIERS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, discount: t })}
                        className={clsx(
                          'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                          form.discount === t
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        )}
                      >
                        {t === 0 ? 'Aucune' : `−${t}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes internes</label>
                  <textarea
                    className="input w-full resize-none"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Informations utiles..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 btn-primary text-sm disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Enregistrement…' : modal === 'create' ? 'Créer le client' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
