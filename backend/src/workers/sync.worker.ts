import cron from 'node-cron';
import { AutomationService } from '../services/automation.service';
import logger from '../lib/logger';

export function initSyncWorker(): void {
  logger.info('Initializing sync worker...');

  const automation = new AutomationService();

  // Daily sync at 6 AM
  cron.schedule('0 6 * * *', async () => {
    logger.info('Running daily API sync...');
    try {
      await automation.syncAllAPIs();
    } catch (error) {
      logger.error('Daily sync error:', error);
    }
  }, {
    timezone: 'Europe/Paris',
  });

  // Weekly report every Monday at 8 AM
  cron.schedule('0 8 * * 1', async () => {
    logger.info('Sending weekly report...');
    try {
      await automation.sendWeeklyReport();
    } catch (error) {
      logger.error('Weekly report error:', error);
    }
  }, {
    timezone: 'Europe/Paris',
  });

  // Sync Shopify orders every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const { ShopifyService } = await import('../services/shopify.service');
      const shopify = new ShopifyService();
      await shopify.syncOrders();
      logger.debug('Shopify orders sync completed');
    } catch (error) {
      logger.error('Shopify orders periodic sync error:', error);
    }
  });

  // Sync Vos Factures every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const { VosFacturesService } = await import('../services/vos-factures.service');
      const vf = new VosFacturesService();
      await vf.syncInvoices();
      logger.debug('Vos Factures sync completed');
    } catch (error) {
      logger.error('Vos Factures periodic sync error:', error);
    }
  });

  logger.info('Sync worker initialized');
}
