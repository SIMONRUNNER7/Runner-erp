import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface SalesData {
  month: string;
  revenue: number;
  orders: number;
}

interface SalesChartProps {
  data: SalesData[];
  loading?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

export default function SalesChart({ data, loading = false }: SalesChartProps) {
  if (loading) {
    return (
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k€`} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value, name) =>
            name === 'revenue' ? [formatCurrency(value as number), 'CA'] : [value, 'Commandes']
          }
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
        />
        <Legend formatter={(value) => (value === 'revenue' ? 'Chiffre d\'affaires' : 'Commandes')} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#colorRevenue)"
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          stroke="#16a34a"
          strokeWidth={2}
          fill="url(#colorOrders)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
