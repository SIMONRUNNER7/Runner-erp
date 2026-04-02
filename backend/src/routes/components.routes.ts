import { Router } from 'express';
import { listComponents, updateComponent, seedComponents } from '../controllers/components.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, listComponents);
router.put('/:id', authenticate, requireRole('president', 'production', 'achats'), updateComponent);
router.post('/seed', authenticate, requireRole('president'), seedComponents);

export default router;
