import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  FileText,
  Users,
  AlertTriangle,
  Clock,
  DollarSign,
} from 'lucide-react';
import { dashboardApi } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import KPICard from '../components/KPICard';
import SalesChart from '../components/charts/SalesChart';
import StatusBadge from '../components/StatusBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export default function Dashboard() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then((r) => r.data),
    refetchInterval: 60000,
  });

  const role = user?.role;
  const kpis = data?.kpis || {};
  const loading = isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500 text-sm mt-1">
          Bonjour {user?.name} — {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* President KPIs */}
      {role === 'president' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="CA ce mois"
              value={loading ? '...' : formatCurrency(kpis.monthRevenue || 0)}
              icon={TrendingUp}
              trend={kpis.revenueGrowth}
              trendLabel="vs mois dernier"
              color="blue"
              loading={loading}
            />
            <KPICard
              title="Commandes ce mois"
              value={loading ? '...' : kpis.monthOrders || 0}
              subtitle={`Total: ${kpis.totalOrders || 0}`}
              icon={ShoppingCart}
              color="green"
              loading={loading}
            />
            <KPICard
              title="Factures en retard"
              value={loading ? '...' : kpis.overdueInvoices || 0}
              icon={FileText}
              color={kpis.overdueInvoices > 0 ? 'red' : 'green'}
              loading={loading}
            />
            <KPICard
              title="Produits en stock"
              value={loading ? '...' : kpis.stockProductCount || 0}
              icon={Package}
              color="purple"
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Évolution des ventes (6 mois)</h3>
              <SalesChart data={data?.charts?.salesByMonth || []} loading={loading} />
            </div>

            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Top Produits</h3>
              <div className="space-y-3">
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                    ))
                  : (data?.charts?.topProducts || []).map((item: { product?: { name: string }; _sum?: { total: number } }, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </div>
                          <span className="text-sm text-gray-700 truncate max-w-[150px]">
                            {item.product?.name || 'Inconnu'}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(item._sum?.total || 0)}
                        </span>
                      </div>
                    ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Dernières commandes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Client</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                          ))}
                        </tr>
                      ))
                    : (data?.recentOrders || []).map((order: { id: string; shopifyNumber?: string; client: { name: string }; total: number; status: string; createdAt: string }) => (
                        <tr key={order.id}>
                          <td className="font-medium text-blue-600">{order.shopifyNumber || `#${order.id.slice(0, 8)}`}</td>
                          <td>{order.client?.name}</td>
                          <td className="font-medium">{formatCurrency(order.total)}</td>
                          <td><StatusBadge status={order.status} /></td>
                          <td className="text-gray-500">{format(new Date(order.createdAt), 'dd/MM/yyyy')}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Commercial KPIs */}
      {role === 'commercial' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="Commandes ouvertes" value={loading ? '...' : kpis.openOrders || 0} icon={ShoppingCart} color="blue" loading={loading} />
            <KPICard title="En attente" value={loading ? '...' : kpis.pendingOrders || 0} icon={Clock} color="yellow" loading={loading} />
            <KPICard title="Clients" value={loading ? '...' : kpis.clientCount || 0} icon={Users} color="green" loading={loading} />
            <KPICard title="CA ce mois" value={loading ? '...' : formatCurrency(kpis.monthRevenue || 0)} icon={TrendingUp} color="purple" loading={loading} />
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Évolution des ventes</h3>
            <SalesChart data={data?.charts?.salesByMonth || []} loading={loading} />
          </div>
        </>
      )}

      {/* Production KPIs */}
      {role === 'production' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard title="En production" value={loading ? '...' : kpis.inProduction || 0} icon={Package} color="purple" loading={loading} />
            <KPICard title="Alertes stock" value={loading ? '...' : kpis.stockAlerts || 0} icon={AlertTriangle} color={kpis.stockAlerts > 0 ? 'red' : 'green'} loading={loading} />
            <KPICard title="Commandes confirmées" value={loading ? '...' : kpis.pendingOrders || 0} icon={ShoppingCart} color="blue" loading={loading} />
          </div>

          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Produits en stock bas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Produit</th><th>SKU</th><th>Stock</th><th>Stock min</th><th>Statut</th></tr>
                </thead>
                <tbody>
                  {(data?.lowStockProducts || []).map((p: { id: string; name: string; sku: string; stock: number; minStock: number }) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-gray-500">{p.sku}</td>
                      <td className="font-medium text-red-600">{p.stock}</td>
                      <td>{p.minStock}</td>
                      <td><StatusBadge status={p.stock === 0 ? 'critical' : 'warning'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Achats KPIs */}
      {role === 'achats' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="BCs en attente" value={loading ? '...' : kpis.pendingPOs || 0} icon={FileText} color="blue" loading={loading} />
            <KPICard title="Fournisseurs" value={loading ? '...' : kpis.suppliers || 0} icon={Users} color="green" loading={loading} />
            <KPICard title="À réapprovisionner" value={loading ? '...' : kpis.replenishmentNeeded || 0} icon={AlertTriangle} color={kpis.replenishmentNeeded > 0 ? 'red' : 'green'} loading={loading} />
            <KPICard title="Total produits" value={loading ? '...' : kpis.totalProducts || 0} icon={Package} color="purple" loading={loading} />
          </div>

          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Produits à réapprovisionner</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>Produit</th><th>SKU</th><th>Stock</th><th>Stock min</th><th>Délai appro.</th></tr>
                </thead>
                <tbody>
                  {(data?.replenishmentList || []).map((p: { id: string; name: string; sku: string; stock: number; minStock: number; supplyDays: number }) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-gray-500">{p.sku}</td>
                      <td className="font-medium text-red-600">{p.stock}</td>
                      <td>{p.minStock}</td>
                      <td>{p.supplyDays} jours</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Comptable KPIs */}
      {role === 'comptable' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard title="CA ce mois" value={loading ? '...' : formatCurrency(kpis.monthRevenue || 0)} icon={DollarSign} color="blue" loading={loading} />
            <KPICard title="Factures impayées" value={loading ? '...' : kpis.unpaidInvoices || 0} icon={FileText} color="yellow" loading={loading} />
            <KPICard title="Factures en retard" value={loading ? '...' : kpis.overdueInvoices || 0} icon={AlertTriangle} color={kpis.overdueInvoices > 0 ? 'red' : 'green'} loading={loading} />
            <KPICard title="Encaissé ce mois" value={loading ? '...' : formatCurrency(kpis.paidThisMonth || 0)} icon={TrendingUp} color="green" loading={loading} />
          </div>

          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Factures récentes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr><th>N° Facture</th><th>Client</th><th>Montant</th><th>Statut</th><th>Échéance</th></tr>
                </thead>
                <tbody>
                  {(data?.recentInvoices || []).map((inv: { id: string; invoiceNumber?: string; client: { name: string }; totalAmount: number; status: string; dueDate?: string }) => (
                    <tr key={inv.id}>
                      <td className="font-medium">{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                      <td>{inv.client?.name}</td>
                      <td className="font-medium">{formatCurrency(inv.totalAmount)}</td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td className="text-gray-500">{inv.dueDate ? format(new Date(inv.dueDate), 'dd/MM/yyyy') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
