import { Router } from 'express';
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  syncShopifyOrders,
  fullResyncShopifyOrders,
  handleShopifyWebhook,
  createInvoiceFromOrder,
  syncOrderMetafields,
  syncAllMetafields,
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
router.post('/sync/shopify/full', authenticate, requireRole('president'), fullResyncShopifyOrders);
router.post('/sync/metafields', authenticate, requireRole('president', 'commercial'), syncAllMetafields);
router.post('/webhooks/shopify', handleShopifyWebhook);

// Invoice from order
router.post('/:id/invoice', authenticate, requireRole('president', 'comptable'), createInvoiceFromOrder);

// Shopify metafields for one order
router.post('/:id/sync-metafields', authenticate, requireRole('president', 'commercial'), syncOrderMetafields);

export default router;
