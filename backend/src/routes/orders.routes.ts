import { Router } from 'express';
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  syncShopifyOrders,
  handleShopifyWebhook,
  createInvoiceFromOrder,
} from '../controllers/orders.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

router.get('/', authenticate, listOrders);
router.get('/:id', authenticate, getOrder);
router.post('/', authenticate, requireRole('president', 'commercial'), createOrder);
router.put('/:id', authenticate, requireRole('president', 'commercial', 'production'), updateOrder);
router.delete('/:id', authenticate, requireRole('president'), deleteOrder);

// Shopify
router.post('/sync/shopify', authenticate, requireRole('president', 'commercial'), syncShopifyOrders);
router.post('/webhooks/shopify', handleShopifyWebhook);

// Invoice from order
router.post('/:id/invoice', authenticate, requireRole('president', 'comptable'), createInvoiceFromOrder);

export default router;
