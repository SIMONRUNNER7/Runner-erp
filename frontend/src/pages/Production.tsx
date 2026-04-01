import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Factory, PlayCircle, Send, Package, AlertTriangle, Clock } from 'lucide-react';
import { ordersApi, stockApi } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

interface OrderItem {
  quantity: number;
  product: { name: string; sku: string };
}

interface Order {
  id: string;
  shopifyNumber?: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  client: { name: string };
  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number | null;
  category: string | null;
}

export default function Production() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const { data: confirmedData, isLoading: loadingConfirmed } = useQuery({
    queryKey: ['orders', 'production', 'confirmed'],
    queryFn: () =>
      ordersApi.list({ status: 'confirmed', limit: 100, sortBy: 'createdAt', sortOrder: 'asc' }).then((r) => r.data),
  });

  const { data: inProductionData, isLoading: loadingInProduction } = useQuery({
    queryKey: ['orders', 'production', 'in_production'],
    queryFn: () =>
      ordersApi.list({ status: 'in_production', limit: 100, sortBy: 'createdAt', sortOrder: 'asc' }).then((r) => r.data),
  });

  const { data: shippedTodayData } = useQuery({
    queryKey: ['orders', 'production', 'shipped_today'],
    queryFn: () =>
      ordersApi
        .list({ status: 'shipped', limit: 100, startDate: startOfToday.toISOString() })
        .then((r) => r.data),
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['stock', 'low-stock'],
    queryFn: () => stockApi.lowStock().then((r) => r.data),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      ordersApi.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'production'] });
      setUpdatingId(null);
    },
    onError: () => setUpdatingId(null),
  });

  const handleStatusChange = (id: string, newStatus: string) => {
    setUpdatingId(id);
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  const confirmedOrders: Order[] = confirmedData?.data || [];
  const inProductionOrders: Order[] = inProductionData?.data || [];
  const shippedToday: number = shippedTodayData?.pagination?.total || 0;
  const lowStockProducts: Product[] = lowStockData || [];

  const isLoading = loadingConfirmed || loadingInProduction;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Factory size={24} className="text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production</h1>
          <p className="text-sm text-gray-500">
            {format(today, "EEEE d MMMM yyyy", { locale: fr })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">À lancer</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock size={18} className="text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{confirmedOrders.length}</p>
          <p className="text-xs text-gray-500 mt-1">commandes confirmées</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">En production</span>
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <Factory size={18} className="text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{inProductionOrders.length}</p>
          <p className="text-xs text-gray-500 mt-1">en cours de fabrication</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Expédiées aujourd'hui</span>
            <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center">
              <Send size={18} className="text-cyan-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{shippedToday}</p>
          <p className="text-xs text-gray-500 mt-1">commandes expédiées</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Alertes stock</span>
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{lowStockProducts.length}</p>
          <p className="text-xs text-gray-500 mt-1">produits en stock bas</p>
        </div>
      </div>

      {/* Queue: Confirmed → start production */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Clock size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">À lancer en production</h2>
          <span className="ml-auto badge bg-blue-100 text-blue-700">{confirmedOrders.length}</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : confirmedOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune commande en attente de production</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {confirmedOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                updating={updatingId === order.id}
                onNavigate={() => navigate(`/orders/${order.id}`)}
                primaryAction={{
                  label: 'Démarrer',
                  icon: PlayCircle,
                  color: 'text-purple-600 hover:bg-purple-50',
                  onClick: () => handleStatusChange(order.id, 'in_production'),
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Queue: In production → ship */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Factory size={18} className="text-purple-600" />
          <h2 className="font-semibold text-gray-900">En cours de production</h2>
          <span className="ml-auto badge bg-purple-100 text-purple-700">{inProductionOrders.length}</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : inProductionOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune commande en production</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {inProductionOrders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                updating={updatingId === order.id}
                onNavigate={() => navigate(`/orders/${order.id}`)}
                primaryAction={{
                  label: 'Expédier',
                  icon: Send,
                  color: 'text-cyan-600 hover:bg-cyan-50',
                  onClick: () => handleStatusChange(order.id, 'shipped'),
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Low stock */}
      {lowStockProducts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600" />
            <h2 className="font-semibold text-gray-900">Stock bas — action requise</h2>
            <span className="ml-auto badge bg-red-100 text-red-700">{lowStockProducts.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="px-6 py-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Package size={16} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.sku}{product.category ? ` · ${product.category}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{product.stock} en stock</p>
                  {product.minStock !== null && (
                    <p className="text-xs text-gray-400">min. {product.minStock}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface RowAction {
  label: string;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
}

function OrderRow({
  order,
  updating,
  onNavigate,
  primaryAction,
}: {
  order: Order;
  updating: boolean;
  onNavigate: () => void;
  primaryAction: RowAction;
}) {
  const totalQty = order.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
  const ActionIcon = primaryAction.icon;

  return (
    <div className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onNavigate}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-blue-600">
            {order.shopifyNumber || `#${order.id.slice(0, 8)}`}
          </span>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-sm text-gray-700">{order.client?.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {totalQty} article{totalQty > 1 ? 's' : ''} ·{' '}
          {format(new Date(order.createdAt), 'dd/MM/yyyy')}
        </p>
      </div>

      <div className="text-right mr-2 hidden sm:block">
        <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.total)}</p>
        {order.items?.slice(0, 2).map((item, i) => (
          <p key={i} className="text-xs text-gray-400 truncate max-w-[160px]">
            {item.quantity}x {item.product?.name}
          </p>
        ))}
        {order.items?.length > 2 && (
          <p className="text-xs text-gray-400">+{order.items.length - 2} autres</p>
        )}
      </div>

      <button
        onClick={primaryAction.onClick}
        disabled={updating}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${primaryAction.color}`}
      >
        {updating ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <ActionIcon size={16} />
        )}
        <span className="hidden sm:inline">{primaryAction.label}</span>
      </button>
    </div>
  );
}
