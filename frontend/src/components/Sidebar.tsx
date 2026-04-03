import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  Users,
  Truck,
  Bell,
  Zap,
  Settings,
  LogOut,
  Factory,
  Store,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore, UserRole } from '../store/auth.store';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['president', 'commercial', 'production', 'achats', 'comptable'] },
  { to: '/orders', label: 'Commandes', icon: ShoppingCart, roles: ['president', 'commercial', 'production', 'achats'] },
  { to: '/stock', label: 'Stock', icon: Package, roles: ['president', 'commercial', 'production', 'achats'] },
  { to: '/production', label: 'Production', icon: Factory, roles: ['president', 'production'] },
  { to: '/invoices', label: 'Factures', icon: FileText, roles: ['president', 'commercial', 'comptable'] },
  { to: '/clients', label: 'Clients', icon: Users, roles: ['president', 'commercial', 'comptable'] },
  { to: '/suppliers', label: 'Fournisseurs', icon: Truck, roles: ['president', 'achats', 'production'] },
  { to: '/b2b-clients', label: 'Clients B2B', icon: Store, roles: ['president', 'commercial'] },
  { to: '/alerts', label: 'Alertes', icon: Bell, roles: ['president', 'commercial', 'production', 'achats', 'comptable'] },
  { to: '/automations', label: 'Automatisations', icon: Zap, roles: ['president'] },
  { to: '/settings', label: 'Paramètres', icon: Settings, roles: ['president'] },
];

const roleLabels: Record<UserRole, string> = {
  president: 'Président',
  commercial: 'Commercial',
  production: 'Production',
  achats: 'Achats',
  comptable: 'Comptable',
};

const roleColors: Record<UserRole, string> = {
  president: 'bg-yellow-500',
  commercial: 'bg-blue-500',
  production: 'bg-purple-500',
  achats: 'bg-green-500',
  comptable: 'bg-cyan-500',
};

export default function Sidebar() {
  const { user } = useAuthStore();
  const { logout } = useAuth();

  const visibleItems = navItems.filter(
    (item) => user && item.roles.includes(user.role as UserRole)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <img
          src="https://cdn.shopify.com/s/files/1/0705/1218/1334/files/THE_RUNNER-LOGOS-BLACK_copie.png?v=1772531379"
          alt="Runner Golf"
          className="h-9 w-auto"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
      </div>

      {/* User info */}
      {user && (
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={clsx('w-2 h-2 rounded-full', roleColors[user.role as UserRole])} />
                <span className="text-sidebar-text text-xs">{roleLabels[user.role as UserRole]}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                    isActive
                      ? 'bg-sidebar-hover text-white border-l-2 border-red-600'
                      : 'text-sidebar-text hover:text-white hover:bg-sidebar-hover border-l-2 border-transparent'
                  )
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-text hover:text-white hover:bg-red-600/20 w-full transition-all duration-150"
        >
          <LogOut size={18} />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
