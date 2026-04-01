import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts';

interface StockData {
  name: string;
  stock: number;
  minStock: number;
}

interface StockChartProps {
  data: StockData[];
  loading?: boolean;
}

const getBarColor = (stock: number, minStock: number) => {
  if (stock === 0) return '#ef4444';
  if (stock <= minStock) return '#f97316';
  if (stock <= minStock * 1.5) return '#eab308';
  return '#22c55e';
};

export default function StockChart({ data, loading = false }: StockChartProps) {
  if (loading) {
    return <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />;
  }

  const displayData = data.slice(0, 15);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) => [value, 'Stock actuel']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
        />
        <Bar dataKey="stock" radius={[4, 4, 0, 0]}>
          {displayData.map((entry, index) => (
            <Cell key={index} fill={getBarColor(entry.stock, entry.minStock)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
