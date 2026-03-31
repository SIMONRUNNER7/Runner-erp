import { Router } from 'express';
import {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  listPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
} from '../controllers/suppliers.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, listSuppliers);
router.get('/:id', authenticate, getSupplier);
router.post('/', authenticate, requireRole('president', 'achats'), createSupplier);
router.put('/:id', authenticate, requireRole('president', 'achats'), updateSupplier);
router.delete('/:id', authenticate, requireRole('president'), deleteSupplier);

// Purchase orders
router.get('/purchase-orders', authenticate, listPurchaseOrders);
router.post('/purchase-orders', authenticate, requireRole('president', 'achats'), createPurchaseOrder);
router.put('/purchase-orders/:id', authenticate, requireRole('president', 'achats'), updatePurchaseOrder);

export default router;
