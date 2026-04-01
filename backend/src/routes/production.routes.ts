import { Router } from 'express';
import { getProductionOrders, updateProductionOrder } from '../controllers/production.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/orders', authenticate, requireRole('president', 'production'), getProductionOrders);
router.put('/orders/:row', authenticate, requireRole('president', 'production'), updateProductionOrder);

export default router;
