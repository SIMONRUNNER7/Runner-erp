import { Router } from 'express';
import { getPermissions, updatePermissions } from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/permissions', authenticate, requireRole('president'), getPermissions);
router.put('/permissions', authenticate, requireRole('president'), updatePermissions);

export default router;
