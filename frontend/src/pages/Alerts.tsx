import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Info, X } from 'lucide-react';
import { alertsApi } from '../lib/api';
import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppStore } from '../store/app.store';

const severityConfig = {
  info: { icon: Info, classes: 'bg-blue-50 border-blue-200 text-blue-700', iconClass: 'text-blue-500' },
  warning: { icon: AlertTriangle, classes: 'bg-orange-50 border-orange-200 text-orange-700', iconClass: 'text-orange-500' },
  critical: { icon: X, classes: 'bg-red-50 border-red-200 text-red-700', iconClass: 'text-red-500' },
};

export default function Alerts() {
  const queryClient = useQueryClient();
  const { setUnreadAlerts } = useAppStore();

  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', page, severity, unreadOnly],
    queryFn: () =>
      alertsApi.list({ page, limit: 30, severity, read: unreadOnly ? false : undefined }).then((r) => r.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => alertsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => alertsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setUnreadAlerts(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => alertsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const alerts = data?.data || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {unreadCount > 0
              ? `${unreadCount} alerte${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Toutes les alertes sont lues'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="btn btn-secondary"
          >
            <CheckCheck size={16} />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <select
            className="input w-auto"
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
          >
            <option value="">Toutes les sévérités</option>
            <option value="info">Info</option>
            <option value="warning">Attention</option>
            <option value="critical">Critique</option>
          </select>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
              className="rounded"
            />
            <span>Non lues seulement</span>
          </label>
        </div>
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))
        ) : alerts.length === 0 ? (
          <div className="card p-12 text-center">
            <Bell size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">Aucune alerte</p>
          </div>
        ) : (
          alerts.map((alert: {
            id: string;
            severity: 'info' | 'warning' | 'critical';
            type: string;
            message: string;
            read: boolean;
            createdAt: string;
          }) => {
            const config = severityConfig[alert.severity] || severityConfig.info;
            const Icon = config.icon;

            return (
              <div
                key={alert.id}
                className={clsx(
                  'rounded-xl border p-4 flex items-start gap-3 transition-opacity',
                  config.classes,
                  alert.read && 'opacity-60'
                )}
              >
                <div className={clsx('mt-0.5', config.iconClass)}>
                  <Icon size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                      {alert.type.replace(/_/g, ' ')}
                    </span>
                    {!alert.read && (
                      <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                    )}
                  </div>
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: fr })}
                    {' · '}
                    {format(new Date(alert.createdAt), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!alert.read && (
                    <button
                      onClick={() => markReadMutation.mutate(alert.id)}
                      className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                      title="Marquer comme lu"
                    >
                      <Check size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="btn btn-secondary btn-sm"
          >
            Précédent
          </button>
          <span className="btn btn-secondary btn-sm pointer-events-none">
            {page} / {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === data.pagination.totalPages}
            className="btn btn-secondary btn-sm"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
