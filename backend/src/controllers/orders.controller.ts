import { Request, Response } from 'express';
import { prisma, io } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';
import { ShopifyService } from '../services/shopify.service';
import { VosFacturesService } from '../services/vos-factures.service';
import { resolveFromShopifyProperties, resolveComponents } from '../services/recipe.service';
import { GoogleSheetsService } from '../services/google-sheets.service';

export const listOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }
    if (search) {
      where.OR = [
        { shopifyNumber: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          client: { select: { id: true, name: true, email: true } },
          items: {
            include: { product: { select: { name: true, sku: true } } },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      data: orders,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error('listOrders error:', error);
    res.status(500).json({ error: 'Failed to list orders' });
  }
};

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        items: {
          include: { product: true },
        },
        invoices: true,
      },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(order);
  } catch (error) {
    logger.error('getOrder error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
};

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { clientId, items, notes, shippingAddress } = req.body;

    if (!clientId || !items || !items.length) {
      res.status(400).json({ error: 'Client and items are required' });
      return;
    }

    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    let total = 0;
    const orderItems = items.map((item: { productId: string; quantity: number; unitPrice?: number }) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const unitPrice = item.unitPrice ?? product.price;
      const itemTotal = unitPrice * item.quantity;
      total += itemTotal;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        total: itemTotal,
      };
    });

    const order = await prisma.order.create({
      data: {
        clientId,
        total,
        notes,
        shippingAddress,
        items: { create: orderItems },
      },
      include: {
        client: true,
        items: { include: { product: true } },
      },
    });

    io.emit('order:created', order);

    res.status(201).json(order);
  } catch (error) {
    logger.error('createOrder error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

export const updateOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, notes, fulfillmentDate } = req.body;

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (notes !== undefined) updateData.notes = notes;
    if (fulfillmentDate !== undefined) updateData.fulfillmentDate = new Date(fulfillmentDate);

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { name: true, email: true } },
        items: { include: { product: { select: { name: true } } } },
      },
    });

    io.emit('order:updated', order);

    // Create alert for status changes
    if (status && status !== existing.status) {
      await prisma.alert.create({
        data: {
          type: 'order_status_change',
          message: `Commande #${order.shopifyNumber || order.id.slice(0, 8)} passée en statut: ${status}`,
          severity: 'info',
        },
      });
    }

    res.json(order);
  } catch (error) {
    logger.error('updateOrder error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
};

export const deleteOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.order.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteOrder error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
};

export const syncShopifyOrders = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shopify = new ShopifyService();
    const result = await shopify.syncOrders();
    res.json(result);
  } catch (error) {
    logger.error('syncShopify error:', error);
    res.status(500).json({ error: 'Shopify sync failed' });
  }
};

export const fullResyncShopifyOrders = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Delete all existing Shopify orders to reimport with correct dates
    await prisma.orderItem.deleteMany({ where: { order: { shopifyId: { not: null } } } });
    await prisma.order.deleteMany({ where: { shopifyId: { not: null } } });

    const shopify = new ShopifyService();
    const result = await shopify.syncOrders();
    res.json({ ...result, message: 'Full resync completed' });
  } catch (error) {
    logger.error('fullResync error:', error);
    res.status(500).json({ error: 'Full resync failed' });
  }
};

export const handleShopifyWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const topic = req.headers['x-shopify-topic'] as string;
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const data = req.body;

    logger.info(`Shopify webhook: ${topic} from ${shopDomain}`);

    const shopify = new ShopifyService();

    if (topic === 'orders/create') {
      await shopify.processWebhookOrder(data, 'create');
    } else if (topic === 'orders/updated') {
      await shopify.processWebhookOrder(data, 'update');
    } else if (topic === 'orders/fulfilled') {
      await shopify.processWebhookOrder(data, 'fulfill');
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Shopify webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// POST /orders/sync/metafields — bulk-fetch metafields for all Shopify orders
// GET /orders/:id/bom — resolve BOM from Shopify line item properties
export const getOrderBOM = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    const results = [];
    for (const item of order.items) {
      const props = item.properties as Array<{ name: string; value: string }> | null;
      if (!props?.length) continue;

      const { attrs, missing } = resolveFromShopifyProperties(item.product?.name || '', props);
      const bomItems = resolveComponents(attrs);

      // Enrich with stock
      const skus = bomItems.map((b) => b.sku);
      const components = await prisma.component.findMany({ where: { sku: { in: skus } } });
      const stockMap = Object.fromEntries(components.map((c) => [c.sku, c.stock]));
      const bom = bomItems.map((b) => ({
        ...b,
        stock:     stockMap[b.sku] ?? null,
        available: stockMap[b.sku] !== undefined && stockMap[b.sku] >= b.qty,
      }));

      results.push({
        itemId: item.id,
        product: item.product?.name,
        attrs,
        missing,
        bom,
        canProduce: bom.every((b) => b.available),
      });
    }

    res.json(results);
  } catch (error) {
    logger.error('getOrderBOM error:', error);
    res.status(500).json({ error: 'Failed to resolve BOM' });
  }
};

// POST /orders/:id/production — push order to Google Sheets production
export const createProductionLine = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { client: true, items: { include: { product: true } } },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

    const item = order.items[0];
    if (!item) { res.status(400).json({ error: 'No line items' }); return; }

    const props = item.properties as Array<{ name: string; value: string }> | null;
    if (!props?.length) {
      res.status(400).json({ error: 'No Shopify properties on this order — sync Shopify first' });
      return;
    }

    const prop = (key: string) => props.find((p) => p.name.toUpperCase() === key.toUpperCase())?.value || '';
    const { attrs } = resolveFromShopifyProperties(item.product?.name || '', props);

    // Normalize to Google Sheet format
    const handRaw = prop('HAND').toUpperCase();
    const main = handRaw === 'LH' ? 'GAUCHER' : 'DROITIER';

    const shaftRaw = prop('SHAFT TYPE').toUpperCase();
    let shaft: string;
    if (shaftRaw.includes('GPS') && shaftRaw.includes('ROUGE')) shaft = 'GPS ROUGE';
    else if (shaftRaw.includes('GPS')) shaft = 'GPS NOIR';
    else shaft = 'STANDARD';

    const taille = prop('SIZE').replace(/[a-zA-Z]/g, '').trim(); // "33in" → "33"

    const couleurMap: Record<string, string> = {
      BLACK: 'NOIR', NOIR: 'NOIR', GREY: 'GRIS', GRAY: 'GRIS', GRIS: 'GRIS', RED: 'ROUGE', ROUGE: 'ROUGE',
    };
    const couleur = couleurMap[attrs.couleur.toUpperCase()] || attrs.couleur;

    let face = attrs.face.trim();
    if (face && !face.includes('°')) face = face + '°';

    const ref = prop('_ref') || order.shopifyNumber || order.id.slice(0, 8);
    const date = new Date(order.createdAt).toLocaleDateString('fr-FR');

    const sheets = new GoogleSheetsService();
    await sheets.appendProductionRow({
      commande:     ref,           // A: reference B2C/B2B/RB
      date,                        // B: DATE COMMANDE
      client:       order.client.name,
      modele:       attrs.modele,
      centre:       attrs.centre,
      offset:       attrs.offset,
      main,                        // DROITIER / GAUCHER
      shaft,                       // STANDARD / GPS NOIR / GPS ROUGE
      taille,                      // "33" (no unit)
      grip:         prop('GRIP TYPE') || attrs.grip,
      couleur,                     // NOIR / GRIS / ROUGE
      mire:         attrs.mire,
      couleurPoids: 'NOIR',
      face,                        // C° / 3° / 4°
      poids:        attrs.poids,
      reglage:      '',
      adresse:      order.shippingAddress || '',
    });

    res.json({ success: true, ref });
  } catch (error) {
    logger.error('createProductionLine error:', error);
    res.status(500).json({ error: 'Failed to create production line' });
  }
};

export const syncAllMetafields = async (_req: Request, res: Response): Promise<void> => {
  try {
    const shopify = new ShopifyService();
    const result = await shopify.syncAllOrderMetafields();
    res.json(result);
  } catch (error) {
    logger.error('syncAllMetafields error:', error);
    res.status(500).json({ error: 'Failed to sync metafields' });
  }
};

// POST /orders/:id/sync-metafields — fetch Shopify metafields for one order
export const syncOrderMetafields = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order?.shopifyId) {
      res.status(404).json({ error: 'Order not found or not a Shopify order' });
      return;
    }
    const shopify = new ShopifyService();
    await shopify.syncOrderMetafields(order.shopifyId);
    const updated = await prisma.order.findUnique({ where: { id: req.params.id } });
    res.json({ metafields: updated?.metafields });
  } catch (error) {
    logger.error('syncOrderMetafields error:', error);
    res.status(500).json({ error: 'Failed to sync metafields' });
  }
};

export const createInvoiceFromOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { client: true, items: { include: { product: true } } },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const vosFactures = new VosFacturesService();
    const invoice = await vosFactures.createInvoiceFromOrder(order);

    res.json(invoice);
  } catch (error) {
    logger.error('createInvoiceFromOrder error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};
