import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, Eye, EyeOff, Key, Users, Settings as SettingsIcon } from 'lucide-react';
import { authApi } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import { format } from 'date-fns';

const ROLES = [
  { value: 'president', label: 'Président' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'production', label: 'Production' },
  { value: 'achats', label: 'Achats' },
  { value: 'comptable', label: 'Comptable' },
];

interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: string;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'api' | 'general'>('users');
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [newUser, setNewUser] = useState<CreateUserForm>({ name: '', email: '', password: '', role: 'commercial' });
  const [showCreateUser, setShowCreateUser] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.users().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserForm) => authApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowCreateUser(false);
      setNewUser({ name: '', email: '', password: '', role: 'commercial' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => authApi.updateUser(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authApi.deleteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const apiConfig = [
    { key: 'SHOPIFY_SHOP_DOMAIN', label: 'Shopify Domain', placeholder: 'your-shop.myshopify.com' },
    { key: 'SHOPIFY_ACCESS_TOKEN', label: 'Shopify Access Token', placeholder: 'shpat_...', secret: true },
    { key: 'VOS_FACTURES_API_TOKEN', label: 'Vos Factures Token', placeholder: 'your_token', secret: true },
    { key: 'GOOGLE_SHEETS_SPREADSHEET_ID', label: 'Google Sheets ID', placeholder: '1pcdlvgVpJ...' },
    { key: 'SMTP_HOST', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
    { key: 'SMTP_USER', label: 'SMTP Email', placeholder: 'noreply@...' },
    { key: 'PRESIDENT_EMAIL', label: 'Email Président', placeholder: 'president@...' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 text-sm mt-1">Configuration du système et gestion des utilisateurs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'users', label: 'Utilisateurs', icon: Users },
          { id: 'api', label: 'Clés API', icon: Key },
          { id: 'general', label: 'Général', icon: SettingsIcon },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateUser(true)}
              className="btn btn-primary"
            >
              <Plus size={16} />
              Nouvel utilisateur
            </button>
          </div>

          {/* Create user form */}
          {showCreateUser && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Créer un utilisateur</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Nom complet</label>
                  <input
                    type="text"
                    className="input"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Mot de passe</label>
                  <input
                    type="password"
                    className="input"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Rôle</label>
                  <select
                    className="input"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowCreateUser(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={() => createMutation.mutate(newUser)}
                  disabled={createMutation.isPending || !newUser.name || !newUser.email || !newUser.password}
                  className="btn btn-primary"
                >
                  <Save size={16} />
                  {createMutation.isPending ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          )}

          {/* Users table */}
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Email</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th>Créé le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                          ))}
                        </tr>
                      ))
                    : (users || []).map((user: {
                        id: string;
                        name: string;
                        email: string;
                        role: string;
                        active: boolean;
                        createdAt: string;
                      }) => (
                        <tr key={user.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium">{user.name}</span>
                            </div>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            <span className="badge bg-gray-100 text-gray-700">
                              {ROLES.find((r) => r.value === user.role)?.label || user.role}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={user.active ? 'active' : 'inactive'} />
                          </td>
                          <td className="text-gray-500">{format(new Date(user.createdAt), 'dd/MM/yyyy')}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateMutation.mutate({ id: user.id, data: { active: !user.active } })}
                                className={`btn btn-sm ${user.active ? 'btn-secondary text-orange-600' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                              >
                                {user.active ? 'Désactiver' : 'Activer'}
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Supprimer ${user.name}?`)) {
                                    deleteMutation.mutate(user.id);
                                  }
                                }}
                                className="btn btn-sm btn-secondary text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* API Keys tab */}
      {activeTab === 'api' && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Configuration des APIs</h3>
          <p className="text-sm text-gray-500 mb-6">
            Ces valeurs sont configurées via le fichier <code className="bg-gray-100 px-1 rounded">.env</code> sur le serveur.
            Consultez le fichier <code className="bg-gray-100 px-1 rounded">.env.example</code> pour la liste complète des variables.
          </p>

          <div className="grid grid-cols-1 gap-4">
            {apiConfig.map((config) => (
              <div key={config.key} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700">{config.label}</label>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{config.key}</p>
                </div>
                <div className="relative w-64">
                  <input
                    type={showPassword[config.key] ? 'text' : 'password'}
                    className="input pr-8 text-xs font-mono"
                    placeholder={config.placeholder}
                    disabled
                    defaultValue="••••••••••••"
                  />
                  {config.secret && (
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => ({ ...prev, [config.key]: !prev[config.key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword[config.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Pour modifier les clés API, éditez le fichier <code>.env</code> sur le serveur
              et redémarrez l'application. Ne jamais exposer ces clés dans l'interface web.
            </p>
          </div>
        </div>
      )}

      {/* General tab */}
      {activeTab === 'general' && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-6">Paramètres généraux</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Nom de l'entreprise</label>
              <input type="text" className="input" defaultValue="RUNNER" />
            </div>
            <div>
              <label className="label">Devise par défaut</label>
              <select className="input">
                <option value="EUR">EUR — Euro</option>
                <option value="USD">USD — Dollar américain</option>
                <option value="GBP">GBP — Livre sterling</option>
              </select>
            </div>
            <div>
              <label className="label">Fuseau horaire</label>
              <select className="input">
                <option value="Europe/Paris">Europe/Paris (UTC+1/+2)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="label">Langue</label>
              <select className="input">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <button className="btn btn-primary">
              <Save size={16} />
              Sauvegarder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
