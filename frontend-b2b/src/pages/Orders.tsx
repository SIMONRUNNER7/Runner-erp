import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from '../lib/api';
import { ChevronDown, ChevronUp, Package } from 'lucide-react';
import { clsx } from 'clsx';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  product: { title: string; sku: string };
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  discount: number;
  notes?: string;
  shopifyOrderNumber?: string;
  createdAt: string;
  items: OrderItem[];
}

const STATUS: Record<string, { label: string; color: string }> = {
  pending:       { label: 'En attente',    color: 'bg-yellow-100 text-yellow-700' },
  confirmed:     { label: 'Confirmée',     color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'En production', color: 'bg-purple-100 text-purple-700' },
  shipped:       { label: 'Expédiée',      color: 'bg-indigo-100 text-indigo-700' },
  delivered:     { label: 'Livrée',        color: 'bg-green-100 text-green-700' },
  cancelled:     { label: 'Annulée',       color: 'bg-red-100 text-red-700' },
};

export default function Orders() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['b2b-orders'],
    queryFn: () => portalApi.orders().then((r) => r.data),
  });

  if (isLoading) return <div className="text-center py-16 text-gray-400">Chargement…</div>;

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Package size={48} className="text-gray-200" />
        <p className="text-gray-400 font-medium">Aucune commande pour l'instant</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Mes commandes</h1>

      <div className="space-y-3">
        {orders.map((order) => {
          const expanded = expandedId === order.id;
          const st = STATUS[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-600' };
          const date = new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

          return (
            <div key={order.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : order.id)}
                className="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">
                      {order.shopifyOrderNumber ? `#${order.shopifyOrderNumber}` : `Commande du ${date}`}
                    </p>
                    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', st.color)}>{st.label}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {order.shopifyOrderNumber ? date + ' · ' : ''}{order.items.length} article{order.items.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 text-sm">{order.totalAmount.toFixed(2)} €</p>
                  {order.discount > 0 && <p className="text-xs text-green-600">−{order.discount}%</p>}
                </div>
                {expanded ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
              </button>

              {expanded && (
                <div className="border-t border-gray-100 px-4 py-4 space-y-3">
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.product.title}</p>
                          <p className="text-xs text-gray-400">{item.product.sku}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-gray-600">{item.quantity} × {item.unitPrice.toFixed(2)} €</p>
                          <p className="font-semibold text-gray-900">{(item.quantity * item.unitPrice).toFixed(2)} €</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {order.notes && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{order.notes}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
