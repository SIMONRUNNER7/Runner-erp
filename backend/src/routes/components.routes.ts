import { Router } from 'express';
import {
  listComponents, updateComponent, seedComponents,
  seedSuppliers, adjustComponent,
} from '../controllers/components.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, listComponents);
router.put('/:id', authenticate, requireRole('president', 'production', 'achats'), updateComponent);
router.post('/:id/adjust', authenticate, requireRole('president', 'production', 'achats'), adjustComponent);
router.post('/seed', authenticate, requireRole('president'), seedComponents);
router.post('/seed-suppliers', authenticate, requireRole('president'), seedSuppliers);

export default router;
