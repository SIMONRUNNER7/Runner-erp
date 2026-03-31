import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  unreadAlerts: number;
  notifications: Notification[];
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setUnreadAlerts: (count: number) => void;
  incrementUnreadAlerts: () => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  unreadAlerts: 0,
  notifications: [],

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setUnreadAlerts: (count) => set({ unreadAlerts: count }),
  incrementUnreadAlerts: () => set((s) => ({ unreadAlerts: s.unreadAlerts + 1 })),

  addNotification: (notification) =>
    set((s) => ({ notifications: [...s.notifications, notification] })),

  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}));
