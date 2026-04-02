import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Save, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { ordersApi } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const ORDER_STATUSES = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'];

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccess } = useAuth();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id!).then((r) => r.data),
    enabled: !!id,
  });

  const [newStatus, setNewStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: object) => ordersApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: () => ordersApi.createInvoice(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const syncMetafieldsMutation = useMutation({
    mutationFn: () => ordersApi.syncMetafields(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
  });

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="card p-6 h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!order) return <div>Commande introuvable</div>;

  const handleUpdate = () => {
    const data: Record<string, string> = {};
    if (newStatus) data.status = newStatus;
    if (trackingNumber) data.trackingNumber = trackingNumber;
    if (Object.keys(data).length > 0) {
      updateMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/orders')} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          Retour
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Commande {order.shopifyNumber || `#${order.id.slice(0, 8)}`}
          </h1>
          <p className="text-gray-500 text-sm">
            Créée le {format(new Date(order.createdAt), 'dd/MM/yyyy à HH:mm')}
          </p>
        </div>
        <StatusBadge status={order.status} className="ml-auto" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Informations client</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Nom</p>
                <p className="font-medium">{order.client?.name}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium">{order.client?.email || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Téléphone</p>
                <p className="font-medium">{order.client?.phone || '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Adresse de livraison</p>
                <p className="font-medium">{order.shippingAddress || '—'}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Articles commandés</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>SKU</th>
                  <th>Qté</th>
                  <th>Prix unitaire</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item: {
                  id: string;
                  product?: { name: string; sku: string };
                  quantity: number;
                  unitPrice: number;
                  total: number;
                  properties?: Array<{ name: string; value: string }>;
                }) => {
                  const hasProps = item.properties && item.properties.length > 0;
                  const expanded = expandedItems.has(item.id);
                  return (
                    <>
                      <tr
                        key={item.id}
                        className={hasProps ? 'cursor-pointer hover:bg-gray-50' : ''}
                        onClick={() => {
                          if (!hasProps) return;
                          setExpandedItems((prev) => {
                            const next = new Set(prev);
                            next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                            return next;
                          });
                        }}
                      >
                        <td className="font-medium">
                          <div className="flex items-center gap-1">
                            {hasProps && (expanded
                              ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                              : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                            )}
                            {item.product?.name || '—'}
                          </div>
                        </td>
                        <td className="text-gray-500 font-mono text-xs">{item.product?.sku || '—'}</td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td className="font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                      {hasProps && expanded && (
                        <tr key={`${item.id}-props`} className="bg-blue-50">
                          <td colSpan={5} className="px-6 py-3">
                            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                              Configuration putter
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
                              {item.properties!.map((p) => (
                                <div key={p.name} className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-500">{p.name}</span>
                                  <span className="font-medium text-gray-900">{p.value}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="text-right font-semibold px-4 py-3">Total</td>
                  <td className="font-bold text-lg px-4 py-3">{formatCurrency(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Metafields */}
          {order.metafields && Array.isArray(order.metafields) && order.metafields.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Metafields Shopify</h3>
              <div className="grid grid-cols-2 gap-3">
                {(order.metafields as Array<{ namespace: string; key: string; value: string }>).map((mf) => (
                  <div key={`${mf.namespace}.${mf.key}`} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                    <p className="text-xs text-gray-400 font-mono">{mf.namespace}.{mf.key}</p>
                    <p className="font-medium text-gray-900 mt-0.5">{mf.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar actions */}
        <div className="space-y-6">
          {/* Update status */}
          {canAccess(['president', 'commercial', 'production']) && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Mettre à jour</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Nouveau statut</label>
                  <select
                    className="input"
                    value={newStatus || order.status}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Numéro de suivi</label>
                  <input
                    type="text"
                    className="input"
                    placeholder={order.trackingNumber || 'Ex: 1Z999AA10123456784'}
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                  className="btn btn-primary w-full justify-center"
                >
                  <Save size={16} />
                  {updateMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
            <div className="space-y-2">
              {canAccess(['president', 'comptable']) && (
                <button
                  onClick={() => createInvoiceMutation.mutate()}
                  disabled={createInvoiceMutation.isPending}
                  className="btn btn-secondary w-full justify-center"
                >
                  <FileText size={16} />
                  {createInvoiceMutation.isPending ? 'Création...' : 'Créer une facture'}
                </button>
              )}
              {order.shopifyId && canAccess(['president', 'commercial']) && (
                <button
                  onClick={() => syncMetafieldsMutation.mutate()}
                  disabled={syncMetafieldsMutation.isPending}
                  className="btn btn-secondary w-full justify-center"
                >
                  <RefreshCw size={16} className={syncMetafieldsMutation.isPending ? 'animate-spin' : ''} />
                  {syncMetafieldsMutation.isPending ? 'Sync...' : 'Sync metafields Shopify'}
                </button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Détails</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Shopify ID</span>
                <span className="font-mono text-xs">{order.shopifyId || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Devise</span>
                <span>{order.currency || 'EUR'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tracking</span>
                <span className="font-mono text-xs">{order.trackingNumber || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mis à jour</span>
                <span>{format(new Date(order.updatedAt), 'dd/MM/yyyy')}</span>
              </div>
            </div>
          </div>

          {/* Invoices */}
          {order.invoices?.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Factures</h3>
              <div className="space-y-2">
                {order.invoices.map((inv: { id: string; invoiceNumber?: string; totalAmount: number; status: string }) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{inv.invoiceNumber || inv.id.slice(0, 8)}</span>
                    <div className="flex items-center gap-2">
                      <span>{formatCurrency(inv.totalAmount)}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
