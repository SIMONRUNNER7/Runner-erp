import { Router } from 'express';
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientHistory,
} from '../controllers/clients.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, listClients);
router.get('/:id', authenticate, getClient);
router.get('/:id/history', authenticate, getClientHistory);
router.post('/', authenticate, requireRole('president', 'commercial'), createClient);
router.put('/:id', authenticate, requireRole('president', 'commercial'), updateClient);
router.delete('/:id', authenticate, requireRole('president'), deleteClient);

export default router;
