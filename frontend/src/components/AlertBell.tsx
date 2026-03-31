import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/app.store';
import { useEffect } from 'react';
import { alertsApi } from '../lib/api';

export default function AlertBell() {
  const { unreadAlerts, setUnreadAlerts } = useAppStore();

  useEffect(() => {
    alertsApi.unreadCount()
      .then((res) => setUnreadAlerts(res.data.count))
      .catch(() => {});
  }, [setUnreadAlerts]);

  return (
    <Link to="/alerts" className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
      <Bell size={20} />
      {unreadAlerts > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {unreadAlerts > 99 ? '99+' : unreadAlerts}
        </span>
      )}
    </Link>
  );
}
