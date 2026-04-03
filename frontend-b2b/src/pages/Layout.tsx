import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useB2BStore } from '../store/b2b.store';
import { useCartStore } from '../store/cart.store';
import { ShoppingBag, ClipboardList, ShoppingCart, LogOut, User } from 'lucide-react';
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
    <div className="font-sans">
      {/* Portal navigation bar */}
      <div className="bg-gray-900 text-white rounded-xl mb-6 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        {/* Left: user info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-sm font-bold">
            {client?.company?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{client?.company}</p>
            <p className="text-xs text-gray-400">
              {client && client.discount > 0
                ? <span className="text-green-400 font-medium">−{client.discount}% remise appliquée</span>
                : 'Prix professionnels'}
            </p>
          </div>
        </div>

        {/* Center: nav links */}
        <nav className="flex gap-1">
          <NavLink to="/products" className={({ isActive }) => clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors', isActive ? 'bg-white text-gray-900 font-medium' : 'text-gray-300 hover:bg-white/10')}>
            <ShoppingBag size={15} /> Catalogue
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors', isActive ? 'bg-white text-gray-900 font-medium' : 'text-gray-300 hover:bg-white/10')}>
            <ClipboardList size={15} /> Commandes
          </NavLink>
          <NavLink
            to="/cart"
            className={({ isActive }) => clsx('relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors', isActive ? 'bg-white text-gray-900 font-medium' : 'text-gray-300 hover:bg-white/10')}
          >
            <ShoppingCart size={15} /> Panier
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium leading-none">
                {cartCount}
              </span>
            )}
          </NavLink>
        </nav>

        {/* Right: logout */}
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors">
          <LogOut size={15} /> Déconnexion
        </button>
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
        {[
          { to: '/products', label: 'Catalogue', Icon: ShoppingBag },
          { to: '/orders', label: 'Commandes', Icon: ClipboardList },
          { to: '/cart', label: `Panier${cartCount > 0 ? ` (${cartCount})` : ''}`, Icon: ShoppingCart },
        ].map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
              isActive ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            )}
          >
            <Icon size={14} /> {label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
