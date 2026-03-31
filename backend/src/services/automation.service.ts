import { prisma } from '../index';
import logger from '../lib/logger';
import { NotificationService } from './notification.service';
import { ShopifyService } from './shopify.service';
import { VosFacturesService } from './vos-factures.service';
import { GoogleSheetsService } from './google-sheets.service';

export class AutomationService {
  private notifications: NotificationService;

  constructor() {
    this.notifications = new NotificationService();
  }

  async checkLowStock(): Promise<void> {
    try {
      const products = await prisma.product.findMany({
        where: { active: true },
      });

      for (const product of products) {
        if (product.stock <= product.minStock) {
          // Check if we already have a recent unread alert for this product
          const recentAlert = await prisma.alert.findFirst({
            where: {
              type: 'low_stock',
              read: false,
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              data: { path: ['productId'], equals: product.id },
            },
          });

          if (!recentAlert) {
            await this.notifications.notifyLowStock(
              product.id,
              product.name,
              product.stock,
              product.minStock
            );
          }
        }
      }
    } catch (error) {
      logger.error('checkLowStock automation error:', error);
    }
  }

  async checkOverdueInvoices(): Promise<void> {
    try {
      const overdueInvoices = await prisma.invoice.findMany({
        where: {
          status: { in: ['sent', 'draft'] },
          dueDate: { lt: new Date() },
        },
        include: { client: true },
      });

      for (const invoice of overdueInvoices) {
        // Update to overdue
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'overdue' },
        });

        // Check for recent alert
        const recentAlert = await prisma.alert.findFirst({
          where: {
            type: 'overdue_invoice',
            read: false,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            data: { path: ['invoiceId'], equals: invoice.id },
          },
        });

        if (!recentAlert) {
          await this.notifications.notifyOverdueInvoice(
            invoice.id,
            invoice.invoiceNumber || invoice.id.slice(0, 8),
            invoice.client.name,
            invoice.totalAmount,
            invoice.dueDate!
          );
        }
      }

      logger.info(`Checked overdue invoices: ${overdueInvoices.length} found`);
    } catch (error) {
      logger.error('checkOverdueInvoices automation error:', error);
    }
  }

  async syncAllAPIs(): Promise<void> {
    logger.info('Starting full API sync...');

    try {
      // Shopify sync
      try {
        const shopify = new ShopifyService();
        const ordersResult = await shopify.syncOrders();
        const productsResult = await shopify.syncProducts();
        logger.info(`Shopify sync: ${ordersResult.synced} orders, ${productsResult.synced} products`);
      } catch (err) {
        logger.error('Shopify sync error:', err);
      }

      // Vos Factures sync
      try {
        const vf = new VosFacturesService();
        const invoicesResult = await vf.syncInvoices();
        const clientsResult = await vf.syncClients();
        logger.info(`VF sync: ${invoicesResult.synced} invoices, ${clientsResult.synced} clients`);
      } catch (err) {
        logger.error('Vos Factures sync error:', err);
      }

      // Google Sheets sync
      try {
        const sheets = new GoogleSheetsService();
        const sheetsResult = await sheets.syncStock();
        logger.info(`Google Sheets sync: ${sheetsResult.synced} products`);
      } catch (err) {
        logger.error('Google Sheets sync error:', err);
      }

      // Post-sync checks
      await this.checkLowStock();
      await this.checkOverdueInvoices();

      logger.info('Full API sync completed');
    } catch (error) {
      logger.error('syncAllAPIs error:', error);
    }
  }

  async processNewShopifyOrder(orderId: string): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { client: true, items: { include: { product: true } } },
      });

      if (!order) return;

      // Auto-create invoice if rule is enabled
      const rule = await prisma.automationRule.findFirst({
        where: { trigger: 'new_shopify_order', active: true },
      });

      if (rule) {
        const vf = new VosFacturesService();
        await vf.createInvoiceFromOrder(order);
        logger.info(`Auto-created invoice for order ${orderId}`);
      }
    } catch (error) {
      logger.error('processNewShopifyOrder error:', error);
    }
  }

  async processOrderShipped(orderId: string): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { client: true },
      });

      if (!order || !order.trackingNumber) return;

      // Update Google Sheets
      const sheets = new GoogleSheetsService();
      await sheets.updateOrderTracking(orderId, order.trackingNumber);

      // Notify customer
      if (order.client.email) {
        await this.notifications.sendEmail({
          to: order.client.email,
          subject: `Votre commande ${order.shopifyNumber || order.id.slice(0, 8)} a été expédiée`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1e3a5f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2>Votre commande est en route! 🚚</h2>
              </div>
              <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
                <p>Bonjour ${order.client.name},</p>
                <p>Votre commande <strong>${order.shopifyNumber || order.id.slice(0, 8)}</strong> a été expédiée.</p>
                <p>Numéro de suivi: <strong>${order.trackingNumber}</strong></p>
                <p>Merci de votre confiance!</p>
                <p>L'équipe RUNNER</p>
              </div>
            </div>
          `,
        });
      }

      logger.info(`Order shipped notification sent for ${orderId}`);
    } catch (error) {
      logger.error('processOrderShipped error:', error);
    }
  }

  async sendWeeklyReport(): Promise<void> {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const [orders, invoices, lowStockCount, topProducts] = await Promise.all([
        prisma.order.aggregate({
          where: { createdAt: { gte: startOfWeek }, status: { not: 'cancelled' } },
          _sum: { total: true },
          _count: { id: true },
        }),
        prisma.invoice.count({ where: { status: 'overdue' } }),
        prisma.product.count({ where: { active: true } }),
        prisma.orderItem.groupBy({
          by: ['productId'],
          where: { order: { createdAt: { gte: startOfWeek } } },
          _sum: { total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 5,
        }),
      ]);

      const productIds = topProducts.map((p) => p.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });

      const lowStockProducts = await prisma.product.findMany({ where: { active: true } });
      const actualLowStock = lowStockProducts.filter((p) => p.stock <= p.minStock);

      await this.notifications.sendWeeklyReport({
        weekRevenue: orders._sum.total || 0,
        weekOrders: orders._count.id,
        overdueInvoices: invoices,
        lowStockCount: actualLowStock.length,
        topProducts: topProducts.map((tp) => ({
          name: products.find((p) => p.id === tp.productId)?.name || 'Unknown',
          revenue: tp._sum.total || 0,
        })),
      });

      // Export to Google Sheets
      const sheets = new GoogleSheetsService();
      await sheets.exportWeeklyReport();

      logger.info('Weekly report sent');
    } catch (error) {
      logger.error('sendWeeklyReport error:', error);
    }
  }

  async runCustomRules(): Promise<void> {
    try {
      const rules = await prisma.automationRule.findMany({
        where: { active: true },
      });

      for (const rule of rules) {
        try {
          await this.executeRule(rule);
          await prisma.automationRule.update({
            where: { id: rule.id },
            data: { lastRun: new Date(), runCount: { increment: 1 } },
          });
        } catch (err) {
          logger.error(`Rule ${rule.id} execution error:`, err);
        }
      }
    } catch (error) {
      logger.error('runCustomRules error:', error);
    }
  }

  private async executeRule(rule: {
    id: string;
    trigger: string;
    conditions: unknown;
    actions: unknown;
  }): Promise<void> {
    logger.debug(`Executing rule ${rule.id}: ${rule.trigger}`);

    const actions = rule.actions as Array<{ type: string; params: Record<string, unknown> }>;

    for (const action of actions) {
      switch (action.type) {
        case 'send_email':
          if (action.params.to && action.params.subject && action.params.body) {
            await this.notifications.sendEmail({
              to: action.params.to as string,
              subject: action.params.subject as string,
              html: action.params.body as string,
            });
          }
          break;
        case 'create_alert':
          await this.notifications.createAlert({
            type: rule.trigger,
            message: action.params.message as string,
            severity: (action.params.severity as 'info' | 'warning' | 'critical') || 'info',
          });
          break;
        default:
          logger.debug(`Unknown action type: ${action.type}`);
      }
    }
  }
}
