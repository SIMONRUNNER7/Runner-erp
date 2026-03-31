import { clsx } from 'clsx';

interface StockLevelProps {
  stock: number;
  minStock: number;
  showLabel?: boolean;
  className?: string;
}

export default function StockLevel({ stock, minStock, showLabel = true, className }: StockLevelProps) {
  const percentage = minStock > 0 ? Math.min((stock / (minStock * 3)) * 100, 100) : 100;

  const getColor = () => {
    if (stock === 0) return 'bg-red-500';
    if (stock <= minStock) return 'bg-orange-400';
    if (stock <= minStock * 1.5) return 'bg-yellow-400';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    if (stock === 0) return 'text-red-600';
    if (stock <= minStock) return 'text-orange-600';
    if (stock <= minStock * 1.5) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusText = () => {
    if (stock === 0) return 'Rupture';
    if (stock <= minStock) return 'Stock bas';
    if (stock <= minStock * 1.5) return 'Attention';
    return 'OK';
  };

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{stock} unités</span>
          <span className={clsx('font-medium', getTextColor())}>{getStatusText()}</span>
        </div>
      )}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-300', getColor())}
          style={{ width: `${Math.max(percentage, stock > 0 ? 5 : 0)}%` }}
        />
      </div>
      {showLabel && (
        <div className="text-xs text-gray-400">Min: {minStock}</div>
      )}
    </div>
  );
}
