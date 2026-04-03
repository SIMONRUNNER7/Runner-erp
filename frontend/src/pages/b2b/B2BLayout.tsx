import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useB2BStore } from '../../store/b2b.store';
import { ShoppingBag, ClipboardList, LogOut, ShoppingCart } from 'lucide-react';
import { clsx } from 'clsx';
import { useB2BCart } from './B2BCart';

export default function B2BLayout() {
  const { client, logout } = useB2BStore();
  const navigate = useNavigate();
  const { items } = useB2BCart();
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  function handleLogout() {
    logout();
    navigate('/b2b/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <img
              src="https://cdn.shopify.com/s/files/1/0705/1218/1334/files/THE_RUNNER-LOGOS-BLACK_copie.png?v=1772531379"
              alt="Runner Golf"
              className="h-7"
            />
            <nav className="hidden sm:flex gap-1">
              <NavLink to="/b2b/products" className={({ isActive }) => clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors', isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
                <ShoppingBag size={15} /> Catalogue
              </NavLink>
              <NavLink to="/b2b/orders" className={({ isActive }) => clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors', isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
                <ClipboardList size={15} /> Mes commandes
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {totalItems > 0 && (
              <NavLink to="/b2b/cart" className={({ isActive }) => clsx('relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors', isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
                <ShoppingCart size={15} />
                <span className="hidden sm:inline">Panier</span>
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">{totalItems}</span>
              </NavLink>
            )}
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
              <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {client?.company?.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-gray-700 max-w-[120px] truncate">{client?.company}</span>
              {client && client.discount > 0 && (
                <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">−{client.discount}%</span>
              )}
            </div>
            <button onClick={handleLogout} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="sm:hidden flex border-t border-gray-100">
          {[
            { to: '/b2b/products', label: 'Catalogue', icon: ShoppingBag },
            { to: '/b2b/orders', label: 'Commandes', icon: ClipboardList },
            { to: '/b2b/cart', label: 'Panier', icon: ShoppingCart, badge: totalItems },
          ].map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx('flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors relative', isActive ? 'text-gray-900 font-medium' : 'text-gray-400')}
            >
              <Icon size={18} />
              {label}
              {badge ? <span className="absolute top-1 right-1/4 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">{badge}</span> : null}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
