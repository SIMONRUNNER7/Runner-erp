import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useB2BStore } from '../store/b2b.store';
import { useCartStore } from '../store/cart.store';
import { ShoppingBag, ClipboardList, ShoppingCart, LogOut } from 'lucide-react';
import { clsx } from 'clsx';

export default function Layout() {
  const { client, logout } = useB2BStore();
  const { items } = useCartStore();
  const navigate = useNavigate();
  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Left: logo + nav */}
          <div className="flex items-center gap-6">
            <a href="https://runner.golf" target="_blank" rel="noopener noreferrer">
              <img
                src="https://cdn.shopify.com/s/files/1/0705/1218/1334/files/THE_RUNNER-LOGOS-BLACK_copie.png?v=1772531379"
                alt="Runner Golf"
                className="h-7"
              />
            </a>
            <nav className="hidden sm:flex gap-1">
              <NavLink to="/products" className={({ isActive }) => clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors', isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
                <ShoppingBag size={15} /> Catalogue
              </NavLink>
              <NavLink to="/orders" className={({ isActive }) => clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors', isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100')}>
                <ClipboardList size={15} /> Commandes
              </NavLink>
            </nav>
          </div>

          {/* Right: cart + user */}
          <div className="flex items-center gap-2">
            <NavLink
              to="/cart"
              className={({ isActive }) => clsx(
                'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <ShoppingCart size={15} />
              <span className="hidden sm:inline">Panier</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium leading-none">
                  {cartCount}
                </span>
              )}
            </NavLink>

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-100">
              <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {client?.company?.charAt(0).toUpperCase()}
              </div>
              <div className="max-w-[140px]">
                <p className="text-xs font-semibold text-gray-800 truncate">{client?.company}</p>
                {client && client.discount > 0 && (
                  <p className="text-xs text-green-600 font-medium">−{client.discount}% remise</p>
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="sm:hidden flex border-t border-gray-100">
          {[
            { to: '/products', label: 'Catalogue', Icon: ShoppingBag },
            { to: '/orders', label: 'Commandes', Icon: ClipboardList },
            { to: '/cart', label: 'Panier', Icon: ShoppingCart, badge: cartCount },
          ].map(({ to, label, Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs relative transition-colors',
                isActive ? 'text-gray-900 font-semibold' : 'text-gray-400'
              )}
            >
              <Icon size={18} />
              {label}
              {badge ? (
                <span className="absolute top-1 right-[calc(50%-20px)] bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
