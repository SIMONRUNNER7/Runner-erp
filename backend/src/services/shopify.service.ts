import axios, { AxiosInstance } from 'axios';
import { prisma } from '../index';
import logger from '../lib/logger';

interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: ShopifyLineItem[];
  customer: ShopifyCustomer;
  total_price: string;
  currency: string;
  shipping_address: ShopifyAddress | null;
  note: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
  fulfillments: ShopifyFulfillment[];
}

interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
  sku: string;
}

interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
}

interface ShopifyAddress {
  address1: string;
  city: string;
  country: string;
  zip: string;
}

interface ShopifyFulfillment {
  tracking_number: string | null;
  tracking_url: string | null;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: ShopifyVariant[];
  status: string;
  product_type: string;
}

interface ShopifyVariant {
  id: number;
  sku: string;
  price: string;
  inventory_quantity: number;
}

export class ShopifyService {
  private client: AxiosInstance;
  private shopDomain: string;

  constructor() {
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '';

    this.client = axios.create({
      baseURL: `https://${this.shopDomain}/admin/api/2024-01`,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async syncOrders(sinceId?: string): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;
    const startTime = Date.now();

    try {
      let pageInfo: string | null = null;
      let hasMore = true;

      while (hasMore) {
        let params: Record<string, string | number>;
        if (pageInfo) {
          // Cursor-based pagination: only limit + page_info allowed
          params = { limit: 250, page_info: pageInfo };
        } else {
          params = { limit: 250, status: 'any' };
          if (sinceId) params.since_id = sinceId;
        }

        const response = await this.client.get('/orders.json', { params });
        const orders: ShopifyOrder[] = response.data.orders;

        for (const shopifyOrder of orders) {
          try {
            await this.upsertOrder(shopifyOrder);
            synced++;
          } catch (err) {
            logger.error(`Failed to sync order ${shopifyOrder.id}:`, err);
            errors++;
          }
        }

        // Check for next page via Link header
        const linkHeader = response.headers['link'] as string | undefined;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const match = linkHeader.match(/page_info=([^&>]+)[^>]*>;\s*rel="next"/);
          pageInfo = match ? match[1] : null;
          hasMore = !!pageInfo;
        } else {
          hasMore = false;
        }
      }

      await prisma.syncLog.create({
        data: {
          service: 'shopify_orders',
          status: errors === 0 ? 'success' : 'partial',
          recordsProcessed: synced,
          error: errors > 0 ? `${errors} orders failed` : null,
          runAt: new Date(),
        },
      });

      logger.info(`Shopify orders synced: ${synced} success, ${errors} errors in ${Date.now() - startTime}ms`);
      return { synced, errors };
    } catch (error) {
      logger.error('Shopify orders sync failed:', error);

      await prisma.syncLog.create({
        data: {
          service: 'shopify_orders',
          status: 'failure',
          recordsProcessed: synced,
          error: error instanceof Error ? error.message : 'Unknown error',
          runAt: new Date(),
        },
      });

      throw error;
    }
  }

  private async upsertOrder(shopifyOrder: ShopifyOrder): Promise<void> {
    // Upsert client
    const customerName = shopifyOrder.customer
      ? `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`.trim()
      : shopifyOrder.email;

    let client = await prisma.client.findUnique({
      where: { shopifyId: String(shopifyOrder.customer?.id || shopifyOrder.email) },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          shopifyId: String(shopifyOrder.customer?.id || shopifyOrder.email),
          name: customerName || shopifyOrder.email,
          email: shopifyOrder.email || shopifyOrder.customer?.email,
          phone: shopifyOrder.customer?.phone || null,
          address: shopifyOrder.shipping_address?.address1,
          city: shopifyOrder.shipping_address?.city,
          country: shopifyOrder.shipping_address?.country || 'France',
        },
      });
    }

    // Map status
    const status = this.mapOrderStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status);
    const trackingNumber = shopifyOrder.fulfillments?.[0]?.tracking_number || null;

    const existingOrder = await prisma.order.findUnique({
      where: { shopifyId: String(shopifyOrder.id) },
    });

    if (existingOrder) {
      await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          status,
          trackingNumber,
          updatedAt: new Date(shopifyOrder.updated_at),
        },
      });
    } else {
      // Prepare items
      const items = [];
      for (const lineItem of shopifyOrder.line_items) {
        let product = await prisma.product.findFirst({
          where: {
            OR: [
              { shopifyId: String(lineItem.product_id) },
              { sku: lineItem.sku },
            ],
          },
        });

        if (!product) {
          product = await prisma.product.create({
            data: {
              shopifyId: String(lineItem.product_id),
              name: lineItem.title,
              sku: lineItem.sku || `SHOPIFY-${lineItem.id}`,
              price: parseFloat(lineItem.price),
            },
          });
        }

        items.push({
          productId: product.id,
          quantity: lineItem.quantity,
          unitPrice: parseFloat(lineItem.price),
          total: parseFloat(lineItem.price) * lineItem.quantity,
        });
      }

      await prisma.order.create({
        data: {
          shopifyId: String(shopifyOrder.id),
          shopifyNumber: `#${shopifyOrder.order_number}`,
          clientId: client.id,
          status,
          total: parseFloat(shopifyOrder.total_price),
          currency: shopifyOrder.currency,
          notes: shopifyOrder.note,
          shippingAddress: shopifyOrder.shipping_address
            ? `${shopifyOrder.shipping_address.address1}, ${shopifyOrder.shipping_address.city}`
            : null,
          trackingNumber,
          createdAt: new Date(shopifyOrder.created_at),
          items: { create: items },
        },
      });

      // Update client stats
      await prisma.client.update({
        where: { id: client.id },
        data: {
          totalOrders: { increment: 1 },
          totalRevenue: { increment: parseFloat(shopifyOrder.total_price) },
        },
      });
    }
  }

  async syncProducts(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      const response = await this.client.get('/products.json', {
        params: { limit: 250, status: 'active' },
      });
      const products: ShopifyProduct[] = response.data.products;

      for (const shopifyProduct of products) {
        for (const variant of shopifyProduct.variants) {
          try {
            await prisma.product.upsert({
              where: { sku: variant.sku || `SHOPIFY-${variant.id}` },
              update: {
                name: shopifyProduct.title,
                price: parseFloat(variant.price),
                stock: variant.inventory_quantity,
                category: shopifyProduct.product_type || null,
                shopifyId: String(shopifyProduct.id),
              },
              create: {
                shopifyId: String(shopifyProduct.id),
                name: shopifyProduct.title,
                sku: variant.sku || `SHOPIFY-${variant.id}`,
                price: parseFloat(variant.price),
                stock: variant.inventory_quantity,
                category: shopifyProduct.product_type || null,
              },
            });
            synced++;
          } catch (err) {
            logger.error(`Failed to sync product ${shopifyProduct.id}:`, err);
            errors++;
          }
        }
      }

      await prisma.syncLog.create({
        data: {
          service: 'shopify_products',
          status: errors === 0 ? 'success' : 'partial',
          recordsProcessed: synced,
          error: errors > 0 ? `${errors} products failed` : null,
        },
      });

      return { synced, errors };
    } catch (error) {
      logger.error('Shopify products sync failed:', error);
      await prisma.syncLog.create({
        data: {
          service: 'shopify_products',
          status: 'failure',
          recordsProcessed: synced,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async processWebhookOrder(data: ShopifyOrder, action: 'create' | 'update' | 'fulfill'): Promise<void> {
    try {
      await this.upsertOrder(data);

      if (action === 'create') {
        await prisma.alert.create({
          data: {
            type: 'new_shopify_order',
            message: `Nouvelle commande Shopify #${data.order_number} - ${data.total_price} ${data.currency}`,
            severity: 'info',
            data: { shopifyId: String(data.id), orderNumber: data.order_number },
          },
        });
      }
    } catch (error) {
      logger.error('Webhook order processing error:', error);
      throw error;
    }
  }

  async updateInventory(shopifyVariantId: string, quantity: number): Promise<void> {
    try {
      // Get inventory item id
      const variantResponse = await this.client.get(`/variants/${shopifyVariantId}.json`);
      const inventoryItemId = variantResponse.data.variant.inventory_item_id;

      // Get location
      const locationsResponse = await this.client.get('/locations.json');
      const locationId = locationsResponse.data.locations[0]?.id;

      if (!locationId) {
        throw new Error('No Shopify location found');
      }

      await this.client.post('/inventory_levels/set.json', {
        inventory_item_id: inventoryItemId,
        location_id: locationId,
        available: quantity,
      });

      logger.info(`Updated Shopify inventory for variant ${shopifyVariantId}: ${quantity}`);
    } catch (error) {
      logger.error('Failed to update Shopify inventory:', error);
      throw error;
    }
  }

  private mapOrderStatus(
    financialStatus: string,
    fulfillmentStatus: string | null
  ): 'pending' | 'confirmed' | 'in_production' | 'shipped' | 'delivered' | 'cancelled' {
    if (financialStatus === 'refunded' || financialStatus === 'voided') {
      return 'cancelled';
    }
    if (fulfillmentStatus === 'fulfilled') {
      return 'delivered';
    }
    if (fulfillmentStatus === 'partial') {
      return 'shipped';
    }
    if (financialStatus === 'paid') {
      return 'confirmed';
    }
    return 'pending';
  }
}
