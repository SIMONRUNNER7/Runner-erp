import axios from 'axios';
import { useB2BStore } from '../store/b2b.store';

const b2bApi = axios.create({
  baseURL: '/api/b2b',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

b2bApi.interceptors.request.use((config) => {
  const token = useB2BStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

b2bApi.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      useB2BStore.getState().logout();
      window.location.href = '/b2b/login';
    }
    return Promise.reject(error);
  }
);

export const portalApi = {
  login: (email: string, password: string) => b2bApi.post('/auth/login', { email, password }),
  register: (data: object) => b2bApi.post('/auth/register', data),
  me: () => b2bApi.get('/auth/me'),
  products: () => b2bApi.get('/products'),
  orders: () => b2bApi.get('/orders'),
  createOrder: (data: object) => b2bApi.post('/orders', data),
};

export default b2bApi;
