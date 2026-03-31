import { clsx } from 'clsx';

type OrderStatus = 'pending' | 'confirmed' | 'in_production' | 'shipped' | 'delivered' | 'cancelled';
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
type POStatus = 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';

type Status = OrderStatus | InvoiceStatus | POStatus | string;

const statusConfig: Record<string, { label: string; classes: string }> = {
  // Order statuses
  pending: { label: 'En attente', classes: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmé', classes: 'bg-blue-100 text-blue-800' },
  in_production: { label: 'En production', classes: 'bg-purple-100 text-purple-800' },
  shipped: { label: 'Expédié', classes: 'bg-cyan-100 text-cyan-800' },
  delivered: { label: 'Livré', classes: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Annulé', classes: 'bg-red-100 text-red-800' },

  // Invoice statuses
  draft: { label: 'Brouillon', classes: 'bg-gray-100 text-gray-800' },
  sent: { label: 'Envoyée', classes: 'bg-blue-100 text-blue-800' },
  paid: { label: 'Payée', classes: 'bg-green-100 text-green-800' },
  overdue: { label: 'En retard', classes: 'bg-red-100 text-red-800' },

  // PO statuses
  received: { label: 'Reçu', classes: 'bg-green-100 text-green-800' },

  // Severity
  info: { label: 'Info', classes: 'bg-blue-100 text-blue-800' },
  warning: { label: 'Attention', classes: 'bg-yellow-100 text-yellow-800' },
  critical: { label: 'Critique', classes: 'bg-red-100 text-red-800' },

  // Generic
  active: { label: 'Actif', classes: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inactif', classes: 'bg-gray-100 text-gray-800' },
  success: { label: 'Succès', classes: 'bg-green-100 text-green-800' },
  failure: { label: 'Échec', classes: 'bg-red-100 text-red-800' },
  partial: { label: 'Partiel', classes: 'bg-yellow-100 text-yellow-800' },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, classes: 'bg-gray-100 text-gray-800' };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}
