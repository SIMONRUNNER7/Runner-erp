import cron from 'node-cron';
import { AutomationService } from '../services/automation.service';
import logger from '../lib/logger';

export function initAlertsWorker(): void {
  logger.info('Initializing alerts worker...');

  const automation = new AutomationService();

  // Check low stock every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    logger.debug('Checking low stock levels...');
    try {
      await automation.checkLowStock();
    } catch (error) {
      logger.error('Low stock check error:', error);
    }
  });

  // Check overdue invoices every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Checking overdue invoices...');
    try {
      await automation.checkOverdueInvoices();
    } catch (error) {
      logger.error('Overdue invoices check error:', error);
    }
  }, {
    timezone: 'Europe/Paris',
  });

  // Run custom automation rules every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await automation.runCustomRules();
    } catch (error) {
      logger.error('Custom rules error:', error);
    }
  });

  // Clean old read alerts older than 30 days
  cron.schedule('0 2 * * *', async () => {
    try {
      const { prisma } = await import('../index');
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await prisma.alert.deleteMany({
        where: {
          read: true,
          createdAt: { lt: thirtyDaysAgo },
        },
      });
      logger.info(`Cleaned ${result.count} old alerts`);
    } catch (error) {
      logger.error('Alert cleanup error:', error);
    }
  }, {
    timezone: 'Europe/Paris',
  });

  logger.info('Alerts worker initialized');
}
