import { Router } from 'express';
import { getSsoUrl, getStatus, MARKETING_ROLES } from '../controllers/marketing.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/status', authenticate, requireRole(...MARKETING_ROLES), getStatus);
router.get('/sso-url', authenticate, requireRole(...MARKETING_ROLES), getSsoUrl);

export default router;
