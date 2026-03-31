import { Router } from 'express';
import {
  listAlerts,
  markAlertRead,
  markAllAlertsRead,
  deleteAlert,
  getUnreadCount,
  createAlert,
} from '../controllers/alerts.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, listAlerts);
router.get('/unread-count', authenticate, getUnreadCount);
router.post('/', authenticate, requireRole('president'), createAlert);
router.put('/mark-all-read', authenticate, markAllAlertsRead);
router.put('/:id/read', authenticate, markAlertRead);
router.delete('/:id', authenticate, deleteAlert);

export default router;
