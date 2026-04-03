import { Router } from 'express';
import {
  b2bLogin, b2bRegister, b2bMe, authenticateB2B,
  b2bGetProducts, b2bGetOrders, b2bCreateOrder,
  adminListB2BClients, adminCreateB2BClient, adminUpdateB2BClient, adminDeleteB2BClient,
  adminListB2BProducts, adminCreateB2BProduct, adminUpdateB2BProduct, adminDeleteB2BProduct,
  adminListB2BOrders,
} from '../controllers/b2b.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// ── Public B2B portal routes ─────────────────────────────────────
router.post('/auth/login',    b2bLogin);
router.post('/auth/register', b2bRegister);
router.get('/auth/me',        authenticateB2B as never, b2bMe as never);

router.get('/products',       authenticateB2B as never, b2bGetProducts as never);
router.get('/orders',         authenticateB2B as never, b2bGetOrders as never);
router.post('/orders',        authenticateB2B as never, b2bCreateOrder as never);

// ── ERP admin routes ──────────────────────────────────────────────
router.get('/admin/clients',           authenticate, requireRole('president', 'commercial'), adminListB2BClients);
router.post('/admin/clients',          authenticate, requireRole('president', 'commercial'), adminCreateB2BClient);
router.put('/admin/clients/:id',       authenticate, requireRole('president', 'commercial'), adminUpdateB2BClient);
router.delete('/admin/clients/:id',    authenticate, requireRole('president'), adminDeleteB2BClient);

router.get('/admin/products',          authenticate, requireRole('president', 'commercial', 'achats'), adminListB2BProducts);
router.post('/admin/products',         authenticate, requireRole('president', 'commercial'), adminCreateB2BProduct);
router.put('/admin/products/:id',      authenticate, requireRole('president', 'commercial'), adminUpdateB2BProduct);
router.delete('/admin/products/:id',   authenticate, requireRole('president'), adminDeleteB2BProduct);

router.get('/admin/orders',            authenticate, requireRole('president', 'commercial', 'production'), adminListB2BOrders);

export default router;
