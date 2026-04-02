import { Router } from 'express';
import { getProductionOrders, updateProductionOrder, downloadProductionPdf } from '../controllers/production.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/orders', authenticate, requireRole('president', 'production'), getProductionOrders);
router.put('/orders/:row', authenticate, requireRole('president', 'production'), updateProductionOrder);
router.get('/orders/:row/pdf', authenticate, requireRole('president', 'production'), downloadProductionPdf);

export default router;
