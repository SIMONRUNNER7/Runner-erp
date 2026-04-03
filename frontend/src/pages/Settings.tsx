import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, Eye, EyeOff, Key, Users, Pencil, ShieldCheck } from 'lucide-react';
import { authApi } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import { format } from 'date-fns';

const ROLES = [
  { value: 'president',  label: 'Président' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'production', label: 'Production' },
  { value: 'achats',     label: 'Achats' },
  { value: 'comptable',  label: 'Comptable' },
];

const MODULES = [
  { key: 'dashboard',  label: 'Tableau de bord' },
  { key: 'orders',     label: 'Commandes' },
  { key: 'stock',      label: 'Stock' },
  { key: 'production', label: 'Production' },
  { key: 'invoices',   label: 'Factures' },
  { key: 'clients',    label: 'Clients' },
  { key: 'suppliers',  label: 'Fournisseurs' },
  { key: 'alerts',     label: 'Alertes' },
  { key: 'settings',   label: 'Paramètres' },
];

const PERMISSIONS: Record<string, Record<string, string>> = {
  president:  { dashboard: 'write', orders: 'write', stock: 'write', production: 'write', invoices: 'write', clients: 'write', suppliers: 'write', alerts: 'write', settings: 'write' },
  commercial: { dashboard: 'read',  orders: 'write', stock: 'read',  production: 'none',  invoices: 'read',  clients: 'write', suppliers: 'none',  alerts: 'read',  settings: 'none' },
  production: { dashboard: 'read',  orders: 'read',  stock: 'write', production: 'write', invoices: 'none',  clients: 'none',  suppliers: 'read',  alerts: 'read',  settings: 'none' },
  achats:     { dashboard: 'read',  orders: 'read',  stock: 'write', production: 'none',  invoices: 'none',  clients: 'none',  suppliers: 'write', alerts: 'read',  settings: 'none' },
  comptable:  { dashboard: 'read',  orders: 'none',  stock: 'none',  production: 'none',  invoices: 'write', clients: 'read',  suppliers: 'none',  alerts: 'read',  settings: 'none' },
};

const PERM_STYLE: Record<string, string> = {
  write: 'bg-green-100 text-green-700',
  read:  'bg-blue-50 text-blue-600',
  none:  'text-gray-300',
};
const PERM_LABEL: Record<string, string> = {
  write: 'Écriture',
  read:  'Lecture',
  none:  '—',
};

interface UserRow { id: string; name: string; email: string; role: string; active: boolean; createdAt: string; }
interface CreateForm { name: string; email: string; password: string; role: string; }
interface EditForm { id: string; name: string; role: string; password: string; }

export default function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'api'>('users');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState<CreateForm>({ name: '', email: '', password: '', role: 'commercial' });
  const [editUser, setEditUser] = useState<EditForm | null>(null);
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.users().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => authApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setNewUser({ name: '', email: '', password: '', role: 'commercial' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => authApi.updateUser(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setEditUser(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authApi.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const apiConfig = [
    { key: 'SHOPIFY_SHOP_DOMAIN',         label: 'Shopify Domain',       placeholder: 'your-shop.myshopify.com', secret: false },
    { key: 'SHOPIFY_ACCESS_TOKEN',         label: 'Shopify Token',        placeholder: 'shpat_...', secret: true },
    { key: 'GOOGLE_SHEETS_SPREADSHEET_ID', label: 'Google Sheets ID',    placeholder: '1pcdlvgVpJ...', secret: false },
    { key: 'SMTP_HOST',                    label: 'SMTP Host',            placeholder: 'smtp.gmail.com', secret: false },
    { key: 'SMTP_USER',                    label: 'SMTP Email',           placeholder: 'noreply@...', secret: false },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 text-sm mt-1">Gestion des utilisateurs et configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { id: 'users',       label: 'Utilisateurs', icon: Users },
          { id: 'permissions', label: 'Accès',        icon: ShieldCheck },
          { id: 'api',         label: 'Clés API',     icon: Key },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Utilisateurs ── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCreate(true)} className="btn btn-primary">
              <Plus size={16} /> Nouvel utilisateur
            </button>
          </div>

          {showCreate && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Créer un utilisateur</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Nom complet</label><input type="text" className="input" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} /></div>
                <div><label className="label">Email</label><input type="email" className="input" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
                <div><label className="label">Mot de passe</label><input type="password" className="input" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
                <div>
                  <label className="label">Rôle</label>
                  <select className="input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowCreate(false)} className="btn btn-secondary">Annuler</button>
                <button onClick={() => createMutation.mutate(newUser)} disabled={createMutation.isPending || !newUser.name || !newUser.email || !newUser.password} className="btn btn-primary">
                  <Save size={16} />{createMutation.isPending ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            {/* Desktop */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Utilisateur</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Rôle</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Statut</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Créé le</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse m-4" /></td>)}</tr>
                    ))
                  : (users || []).map((u: UserRow) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white text-sm font-medium">{u.name.charAt(0).toUpperCase()}</div>
                            <span className="font-medium">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3"><span className="badge bg-gray-100 text-gray-700">{ROLES.find((r) => r.value === u.role)?.label || u.role}</span></td>
                        <td className="px-4 py-3"><StatusBadge status={u.active ? 'active' : 'inactive'} /></td>
                        <td className="px-4 py-3 text-gray-500">{format(new Date(u.createdAt), 'dd/MM/yyyy')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setEditUser({ id: u.id, name: u.name, role: u.role, password: '' })} className="btn btn-secondary btn-sm"><Pencil size={13} /> Modifier</button>
                            <button onClick={() => updateMutation.mutate({ id: u.id, data: { active: !u.active } })} className={`btn btn-sm ${u.active ? 'btn-secondary text-orange-600' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>{u.active ? 'Désactiver' : 'Activer'}</button>
                            <button onClick={() => { if (window.confirm(`Supprimer ${u.name} ?`)) deleteMutation.mutate(u.id); }} className="btn btn-sm btn-secondary text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gray-100">
              {(users || []).map((u: UserRow) => (
                <div key={u.id} className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-white font-medium shrink-0">{u.name.charAt(0).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <StatusBadge status={u.active ? 'active' : 'inactive'} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge bg-gray-100 text-gray-700 text-xs">{ROLES.find((r) => r.value === u.role)?.label || u.role}</span>
                    <button onClick={() => setEditUser({ id: u.id, name: u.name, role: u.role, password: '' })} className="btn btn-secondary btn-sm text-xs"><Pencil size={12} /> Modifier</button>
                    <button onClick={() => updateMutation.mutate({ id: u.id, data: { active: !u.active } })} className={`btn btn-sm text-xs ${u.active ? 'btn-secondary text-orange-600' : 'bg-green-100 text-green-700'}`}>{u.active ? 'Désactiver' : 'Activer'}</button>
                    <button onClick={() => { if (window.confirm(`Supprimer ${u.name} ?`)) deleteMutation.mutate(u.id); }} className="btn btn-sm btn-secondary text-red-600 text-xs"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Accès / Permissions ── */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="card p-3 bg-gray-50 border border-gray-200 text-sm text-gray-600">
            Les accès sont définis par <strong>rôle</strong>. Pour changer les droits d'un utilisateur, changez son rôle dans l'onglet Utilisateurs.
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 sticky left-0 bg-gray-50">Module</th>
                  {ROLES.map((r) => <th key={r.value} className="text-center px-3 py-3 font-medium text-gray-700 whitespace-nowrap">{r.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {MODULES.map((mod) => (
                  <tr key={mod.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700 sticky left-0 bg-white">{mod.label}</td>
                    {ROLES.map((role) => {
                      const perm = PERMISSIONS[role.value]?.[mod.key] || 'none';
                      return (
                        <td key={role.value} className="px-3 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PERM_STYLE[perm]}`}>
                            {PERM_LABEL[perm]}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-100 inline-block" /> Écriture (voir + créer + modifier)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-100 inline-block" /> Lecture seule</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-100 inline-block" /> Pas d'accès</span>
          </div>
        </div>
      )}

      {/* ── API Keys ── */}
      {activeTab === 'api' && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-1">Configuration des APIs</h3>
          <p className="text-sm text-gray-500 mb-4">Configurées via le fichier <code className="bg-gray-100 px-1 rounded">.env</code> sur le serveur.</p>
          <div className="space-y-3">
            {apiConfig.map((c) => (
              <div key={c.key} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{c.label}</p>
                  <p className="text-xs text-gray-400 font-mono">{c.key}</p>
                </div>
                <div className="relative sm:w-52">
                  <input type={showKey[c.key] ? 'text' : 'password'} className="input pr-8 text-xs font-mono" placeholder={c.placeholder} disabled defaultValue="••••••••••••" />
                  {c.secret && (
                    <button type="button" onClick={() => setShowKey((p) => ({ ...p, [c.key]: !p[c.key] }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                      {showKey[c.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit user modal ── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-gray-900 mb-4">Modifier l'utilisateur</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Nom complet</label>
                <input type="text" className="input" value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Rôle</label>
                <select className="input" value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Définit les accès (voir onglet Accès).</p>
              </div>
              <div>
                <label className="label">Nouveau mot de passe <span className="text-gray-400 font-normal">(vide = inchangé)</span></label>
                <div className="relative">
                  <input type={showEditPwd ? 'text' : 'password'} className="input pr-8" placeholder="Laisser vide pour ne pas changer..." value={editUser.password} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} />
                  <button type="button" onClick={() => setShowEditPwd((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showEditPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditUser(null)} className="btn btn-secondary flex-1 justify-center">Annuler</button>
              <button
                onClick={() => {
                  const data: Record<string, string> = { name: editUser.name, role: editUser.role };
                  if (editUser.password) data.password = editUser.password;
                  updateMutation.mutate({ id: editUser.id, data });
                }}
                disabled={updateMutation.isPending || !editUser.name}
                className="btn btn-primary flex-1 justify-center"
              >
                <Save size={16} />{updateMutation.isPending ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
