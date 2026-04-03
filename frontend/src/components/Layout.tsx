import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import AlertBell from './AlertBell';
import { useAppStore } from '../store/app.store';
import { useAuthStore } from '../store/auth.store';
import { clsx } from 'clsx';
import { useEffect } from 'react';
import { connectSocket, joinRoleRooms } from '../lib/socket';

export default function Layout() {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const { user } = useAuthStore();

  useEffect(() => {
    connectSocket();
    joinRoleRooms();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 bg-sidebar transition-all duration-300 flex flex-col',
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        )}
      >
        <Sidebar />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Main content */}
      <div
        className={clsx(
          'flex-1 flex flex-col min-h-screen transition-all duration-300',
          sidebarOpen ? 'lg:ml-64' : 'ml-0'
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 h-14 flex items-center px-4 gap-4">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <AlertBell />

            <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
              <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
