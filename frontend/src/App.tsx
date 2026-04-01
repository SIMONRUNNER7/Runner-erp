import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
