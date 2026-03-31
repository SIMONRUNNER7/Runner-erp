import { Router } from 'express';
import {
  listAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  getSyncLogs,
  triggerSync,
} from '../controllers/automations.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, requireRole('president'), listAutomations);
router.get('/sync-logs', authenticate, requireRole('president'), getSyncLogs);
router.post('/sync/:service', authenticate, requireRole('president'), triggerSync);
router.get('/:id', authenticate, requireRole('president'), getAutomation);
router.post('/', authenticate, requireRole('president'), createAutomation);
router.put('/:id', authenticate, requireRole('president'), updateAutomation);
router.delete('/:id', authenticate, requireRole('president'), deleteAutomation);

export default router;
