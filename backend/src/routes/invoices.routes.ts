import { Router } from 'express';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  syncVosFactures,
  sendPaymentReminder,
  getInvoiceStats,
} from '../controllers/invoices.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, listInvoices);
router.get('/stats', authenticate, requireRole('president', 'comptable'), getInvoiceStats);
router.get('/:id', authenticate, getInvoice);
router.post('/', authenticate, requireRole('president', 'comptable'), createInvoice);
router.put('/:id', authenticate, requireRole('president', 'comptable'), updateInvoice);
router.post('/sync/vos-factures', authenticate, requireRole('president', 'comptable'), syncVosFactures);
router.post('/:id/reminder', authenticate, requireRole('president', 'comptable'), sendPaymentReminder);

export default router;
