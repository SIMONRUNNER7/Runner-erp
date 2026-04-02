import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor: attach JWT
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// API helpers
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  users: () => api.get('/auth/users'),
  createUser: (data: object) => api.post('/auth/users', data),
  updateUser: (id: string, data: object) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/auth/users/${id}`),
};

export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

export const ordersApi = {
  list: (params?: object) => api.get('/orders', { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (data: object) => api.post('/orders', data),
  update: (id: string, data: object) => api.put(`/orders/${id}`, data),
  delete: (id: string) => api.delete(`/orders/${id}`),
  syncShopify: () => api.post('/orders/sync/shopify'),
  createInvoice: (id: string) => api.post(`/orders/${id}/invoice`),
  syncMetafields: (id: string) => api.post(`/orders/${id}/sync-metafields`),
  syncAllMetafields: () => api.post('/orders/sync/metafields'),
};

export const stockApi = {
  list: (params?: object) => api.get('/stock', { params }),
  get: (id: string) => api.get(`/stock/${id}`),
  create: (data: object) => api.post('/stock', data),
  update: (id: string, data: object) => api.put(`/stock/${id}`, data),
  adjust: (id: string, data: object) => api.post(`/stock/${id}/adjust`, data),
  movements: (params?: object) => api.get('/stock/movements', { params }),
  lowStock: () => api.get('/stock/low-stock'),
  syncSheets: () => api.post('/stock/sync/google-sheets'),
};

export const invoicesApi = {
  list: (params?: object) => api.get('/invoices', { params }),
  get: (id: string) => api.get(`/invoices/${id}`),
  create: (data: object) => api.post('/invoices', data),
  update: (id: string, data: object) => api.put(`/invoices/${id}`, data),
  stats: () => api.get('/invoices/stats'),
  sync: () => api.post('/invoices/sync/vos-factures'),
  sendReminder: (id: string) => api.post(`/invoices/${id}/reminder`),
};

export const clientsApi = {
  list: (params?: object) => api.get('/clients', { params }),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: object) => api.post('/clients', data),
  update: (id: string, data: object) => api.put(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
  history: (id: string) => api.get(`/clients/${id}/history`),
};

export const suppliersApi = {
  list: (params?: object) => api.get('/suppliers', { params }),
  get: (id: string) => api.get(`/suppliers/${id}`),
  create: (data: object) => api.post('/suppliers', data),
  update: (id: string, data: object) => api.put(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/suppliers/${id}`),
  purchaseOrders: (params?: object) => api.get('/suppliers/purchase-orders', { params }),
  createPO: (data: object) => api.post('/suppliers/purchase-orders', data),
  updatePO: (id: string, data: object) => api.put(`/suppliers/purchase-orders/${id}`, data),
};

export const alertsApi = {
  list: (params?: object) => api.get('/alerts', { params }),
  unreadCount: () => api.get('/alerts/unread-count'),
  markRead: (id: string) => api.put(`/alerts/${id}/read`),
  markAllRead: () => api.put('/alerts/mark-all-read'),
  delete: (id: string) => api.delete(`/alerts/${id}`),
};

export const productionApi = {
  orders: () => api.get('/production/orders'),
  updateRow: (row: number, field: string, value: string) =>
    api.put(`/production/orders/${row}`, { field, value }),
  pdfUrl: (row: number) => `/api/production/orders/${row}/pdf`,
  bom: (row: number) => api.get(`/production/orders/${row}/bom`),
  consume: (row: number) => api.post(`/production/orders/${row}/consume`),
};

export const componentsApi = {
  list: () => api.get('/components'),
  update: (id: string, data: object) => api.put(`/components/${id}`, data),
  adjust: (id: string, data: object) => api.post(`/components/${id}/adjust`, data),
  seed: () => api.post('/components/seed'),
  seedSuppliers: () => api.post('/components/seed-suppliers'),
};

export const automationsApi = {
  list: () => api.get('/automations'),
  get: (id: string) => api.get(`/automations/${id}`),
  create: (data: object) => api.post('/automations', data),
  update: (id: string, data: object) => api.put(`/automations/${id}`, data),
  delete: (id: string) => api.delete(`/automations/${id}`),
  syncLogs: (params?: object) => api.get('/automations/sync-logs', { params }),
  triggerSync: (service: string) => api.post(`/automations/sync/${service}`),
};
