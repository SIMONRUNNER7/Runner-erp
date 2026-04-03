import axios from 'axios';
import { useB2BStore } from '../store/b2b.store';

// In production: calls go to https://erp.runner.golf/api/b2b/...
// In dev: Vite proxy handles /api → localhost:3000
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/b2b';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = useB2BStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      useB2BStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const portalApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: object) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  products: () => api.get('/products'),
  orders: () => api.get('/orders'),
  createOrder: (data: object) => api.post('/orders', data),
};

export default api;
