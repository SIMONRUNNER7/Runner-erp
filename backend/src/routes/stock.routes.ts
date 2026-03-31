import { Router } from 'express';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  adjustStock,
  getStockMovements,
  syncGoogleSheets,
  getLowStockProducts,
} from '../controllers/stock.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, listProducts);
router.get('/movements', authenticate, getStockMovements);
router.get('/low-stock', authenticate, getLowStockProducts);
router.get('/:id', authenticate, getProduct);
router.post('/', authenticate, requireRole('president', 'production', 'achats'), createProduct);
router.put('/:id', authenticate, requireRole('president', 'production', 'achats'), updateProduct);
router.post('/:id/adjust', authenticate, requireRole('president', 'production', 'achats'), adjustStock);
router.post('/sync/google-sheets', authenticate, requireRole('president', 'production', 'achats'), syncGoogleSheets);

export default router;
