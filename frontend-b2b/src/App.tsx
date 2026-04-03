import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useB2BStore } from './store/b2b.store';
import Login from './pages/Login';
import Layout from './pages/Layout';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Orders from './pages/Orders';

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useB2BStore();
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
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route index element={<Navigate to="/products" replace />} />
          <Route path="products" element={<Products />} />
          <Route path="cart" element={<Cart />} />
          <Route path="orders" element={<Orders />} />
        </Route>
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
