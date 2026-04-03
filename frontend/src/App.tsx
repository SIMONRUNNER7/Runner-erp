import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { useB2BStore } from './store/b2b.store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Stock from './pages/Stock';
import Invoices from './pages/Invoices';
import Clients from './pages/Clients';
import Suppliers from './pages/Suppliers';
import Alerts from './pages/Alerts';
import Automations from './pages/Automations';
import Settings from './pages/Settings';
import Production from './pages/Production';
import B2BClients from './pages/B2BClients';
import B2BLogin from './pages/b2b/B2BLogin';
import B2BLayout from './pages/b2b/B2BLayout';
import B2BProducts from './pages/b2b/B2BProducts';
import B2BCartPage from './pages/b2b/B2BCartPage';
import B2BOrders from './pages/b2b/B2BOrders';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function B2BProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useB2BStore();
  if (!isAuthenticated) return <Navigate to="/b2b/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ERP */}
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="stock" element={<Stock />} />
          <Route path="production" element={<Production />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="clients" element={<Clients />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="automations" element={<Automations />} />
          <Route path="settings" element={<Settings />} />
          <Route path="b2b-clients" element={<B2BClients />} />
        </Route>

        {/* B2B Portal */}
        <Route path="/b2b/login" element={<B2BLogin />} />
        <Route
          path="/b2b"
          element={
            <B2BProtectedRoute>
              <B2BLayout />
            </B2BProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/b2b/products" replace />} />
          <Route path="products" element={<B2BProducts />} />
          <Route path="cart" element={<B2BCartPage />} />
          <Route path="orders" element={<B2BOrders />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
