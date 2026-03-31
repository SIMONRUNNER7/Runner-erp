import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Save } from 'lucide-react';
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
                {(order.items || []).map((item: { id: string; product?: { name: string; sku: string }; quantity: number; unitPrice: number; total: number }) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.product?.name || '—'}</td>
                    <td className="text-gray-500 font-mono text-xs">{item.product?.sku || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td className="font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="text-right font-semibold px-4 py-3">Total</td>
                  <td className="font-bold text-lg px-4 py-3">{formatCurrency(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
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
