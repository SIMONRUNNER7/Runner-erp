import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Plus, Trash2, Clock, CheckCircle, XCircle, RefreshCw, ToggleLeft } from 'lucide-react';
import { automationsApi } from '../lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx } from 'clsx';

const TRIGGER_TYPES = [
  { value: 'low_stock', label: 'Stock bas détecté' },
  { value: 'new_shopify_order', label: 'Nouvelle commande Shopify' },
  { value: 'invoice_overdue', label: 'Facture en retard' },
  { value: 'order_shipped', label: 'Commande expédiée' },
  { value: 'daily_sync', label: 'Synchronisation quotidienne' },
  { value: 'weekly_report', label: 'Rapport hebdomadaire' },
];

export default function Automations() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');

  const { data: rules, isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: () => automationsApi.list().then((r) => r.data),
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => automationsApi.syncLogs({ limit: 50 }).then((r) => r.data),
    enabled: activeTab === 'logs',
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => automationsApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => automationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  });

  const syncMutation = useMutation({
    mutationFn: (service: string) => automationsApi.triggerSync(service),
  });

  const syncServices = [
    { id: 'shopify', label: 'Shopify', color: 'bg-green-500' },
    { id: 'vos-factures', label: 'Vos Factures', color: 'bg-blue-500' },
    { id: 'google-sheets', label: 'Google Sheets', color: 'bg-yellow-500' },
    { id: 'all', label: 'Tout synchroniser', color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automatisations</h1>
          <p className="text-gray-500 text-sm mt-1">Règles automatiques et synchronisations</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={16} />
          Nouvelle règle
        </button>
      </div>

      {/* Quick sync */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Synchronisation manuelle</h3>
        <div className="flex flex-wrap gap-3">
          {syncServices.map((service) => (
            <button
              key={service.id}
              onClick={() => syncMutation.mutate(service.id)}
              disabled={syncMutation.isPending}
              className="btn btn-secondary"
            >
              <RefreshCw size={16} className={syncMutation.isPending && syncMutation.variables === service.id ? 'animate-spin' : ''} />
              {service.label}
            </button>
          ))}
        </div>
        {syncMutation.isSuccess && (
          <p className="text-green-600 text-sm mt-3 flex items-center gap-1">
            <CheckCircle size={14} />
            Synchronisation lancée avec succès
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {['rules', 'logs'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t as 'rules' | 'logs')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'rules' ? 'Règles actives' : 'Journaux de sync'}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && (
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : !rules?.length ? (
            <div className="card p-12 text-center">
              <Play size={48} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Aucune règle d'automatisation configurée</p>
              <button className="btn btn-primary mt-4">
                <Plus size={16} />
                Créer une règle
              </button>
            </div>
          ) : (
            rules.map((rule: {
              id: string;
              name: string;
              trigger: string;
              active: boolean;
              runCount: number;
              lastRun?: string;
              conditions: unknown;
              actions: unknown;
            }) => (
              <div key={rule.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={clsx(
                      'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      rule.active ? 'bg-green-100' : 'bg-gray-100'
                    )}>
                      <Play size={16} className={rule.active ? 'text-green-600' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                        <span className={clsx(
                          'badge text-xs',
                          rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        )}>
                          {rule.active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Déclencheur: {TRIGGER_TYPES.find((t) => t.value === rule.trigger)?.label || rule.trigger}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          Exécutions: {rule.runCount}
                        </span>
                        {rule.lastRun && (
                          <span>
                            Dernière: {formatDistanceToNow(new Date(rule.lastRun), { addSuffix: true, locale: fr })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateMutation.mutate({ id: rule.id, data: { active: !rule.active } })}
                      className={clsx(
                        'btn btn-sm',
                        rule.active ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                      )}
                    >
                      <ToggleLeft size={14} />
                      {rule.active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(rule.id)}
                      className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Statut</th>
                  <th>Enregistrements</th>
                  <th>Erreur</th>
                  <th>Exécuté le</th>
                </tr>
              </thead>
              <tbody>
                {logsLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  : (logs?.data || []).map((log: {
                      id: string;
                      service: string;
                      status: string;
                      recordsProcessed: number;
                      error?: string;
                      runAt: string;
                    }) => (
                      <tr key={log.id}>
                        <td className="font-medium">{log.service}</td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {log.status === 'success' ? (
                              <CheckCircle size={14} className="text-green-500" />
                            ) : log.status === 'partial' ? (
                              <CheckCircle size={14} className="text-yellow-500" />
                            ) : (
                              <XCircle size={14} className="text-red-500" />
                            )}
                            <span className={clsx(
                              'text-sm',
                              log.status === 'success' ? 'text-green-700' :
                              log.status === 'partial' ? 'text-yellow-700' :
                              'text-red-700'
                            )}>
                              {log.status}
                            </span>
                          </div>
                        </td>
                        <td>{log.recordsProcessed}</td>
                        <td className="text-red-600 text-xs max-w-xs truncate">{log.error || '—'}</td>
                        <td className="text-gray-500">{format(new Date(log.runAt), 'dd/MM/yyyy HH:mm:ss')}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
