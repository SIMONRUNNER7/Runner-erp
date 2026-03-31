import { google, sheets_v4 } from 'googleapis';
import { prisma } from '../index';
import logger from '../lib/logger';

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId =
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
      '1pcdlvgVpJugMzGoaIaVTFdiUpCSHXLiXj9ugj_kjf6I';

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async syncStock(): Promise<{ synced: number; errors: number; exported: number }> {
    let synced = 0;
    let errors = 0;
    let exported = 0;

    try {
      // Read from Google Sheets
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Stock!A2:G',
      });

      const rows = response.data.values || [];
      logger.info(`Reading ${rows.length} rows from Google Sheets`);

      for (const row of rows) {
        try {
          const [sku, , , stock, minStock, supplyDays] = row;
          if (!sku) continue;

          const product = await prisma.product.findUnique({ where: { sku: String(sku) } });
          if (product) {
            const updates: Record<string, unknown> = {};
            if (stock !== undefined && stock !== '') updates.stock = parseInt(stock);
            if (minStock !== undefined && minStock !== '') updates.minStock = parseInt(minStock);
            if (supplyDays !== undefined && supplyDays !== '')
              updates.supplyDays = parseInt(supplyDays);

            if (Object.keys(updates).length > 0) {
              await prisma.product.update({ where: { id: product.id }, data: updates });
              synced++;
            }
          }
        } catch (err) {
          logger.error('Row sync error:', err);
          errors++;
        }
      }

      // Export current stock to Google Sheets
      exported = await this.exportStock();

      await prisma.syncLog.create({
        data: {
          service: 'google_sheets',
          status: errors === 0 ? 'success' : 'partial',
          recordsProcessed: synced,
          error: errors > 0 ? `${errors} rows failed` : null,
          details: { exported },
        },
      });

      return { synced, errors, exported };
    } catch (error) {
      logger.error('Google Sheets sync failed:', error);
      await prisma.syncLog.create({
        data: {
          service: 'google_sheets',
          status: 'failure',
          recordsProcessed: synced,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  async exportStock(): Promise<number> {
    try {
      const products = await prisma.product.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        include: {
          supplierProducts: {
            include: { supplier: { select: { name: true } } },
          },
        },
      });

      const headers = [['SKU', 'Nom', 'Catégorie', 'Stock', 'Stock Min', 'Délai Approvisionnement', 'Fournisseur', 'Statut']];
      const rows = products.map((p) => [
        p.sku,
        p.name,
        p.category || '',
        p.stock,
        p.minStock,
        p.supplyDays,
        p.supplierProducts[0]?.supplier.name || '',
        p.stock <= p.minStock ? 'ALERTE STOCK BAS' : 'OK',
      ]);

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'Stock!A1:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [...headers, ...rows],
        },
      });

      logger.info(`Exported ${products.length} products to Google Sheets`);
      return products.length;
    } catch (error) {
      logger.error('Export stock to Google Sheets failed:', error);
      throw error;
    }
  }

  async syncSupplyTimes(): Promise<void> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Approvisionnement!A2:D',
      });

      const rows = response.data.values || [];

      for (const row of rows) {
        const [sku, , supplyDays] = row;
        if (!sku || !supplyDays) continue;

        await prisma.product.updateMany({
          where: { sku: String(sku) },
          data: { supplyDays: parseInt(supplyDays) },
        });
      }

      logger.info('Supply times synced from Google Sheets');
    } catch (error) {
      logger.error('Supply times sync failed:', error);
      throw error;
    }
  }

  async exportWeeklyReport(): Promise<void> {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const [orders, invoices, products] = await Promise.all([
        prisma.order.aggregate({
          where: {
            createdAt: { gte: startOfWeek },
            status: { not: 'cancelled' },
          },
          _sum: { total: true },
          _count: { id: true },
        }),
        prisma.invoice.aggregate({
          where: { status: 'paid', paidAt: { gte: startOfWeek } },
          _sum: { totalAmount: true },
        }),
        prisma.product.count({ where: { active: true, stock: { lte: 5 } } }),
      ]);

      const reportDate = now.toLocaleDateString('fr-FR');
      const reportData = [
        [`Rapport Hebdomadaire - ${reportDate}`],
        [],
        ['Commandes cette semaine', orders._count.id],
        ['CA commandes', `${orders._sum.total || 0} EUR`],
        ['Factures payées', `${invoices._sum.totalAmount || 0} EUR`],
        ['Produits en stock bas', products],
        [],
        [`Généré le ${now.toLocaleString('fr-FR')}`],
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Rapports!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: reportData },
      });

      logger.info('Weekly report exported to Google Sheets');
    } catch (error) {
      logger.error('Weekly report export failed:', error);
      throw error;
    }
  }

  async updateOrderTracking(orderId: string, trackingNumber: string): Promise<void> {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { client: true },
      });

      if (!order) return;

      const rowData = [[
        order.shopifyNumber || order.id.slice(0, 8),
        order.client.name,
        trackingNumber,
        new Date().toLocaleDateString('fr-FR'),
      ]];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Expéditions!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rowData },
      });
    } catch (error) {
      logger.error('Failed to update order tracking in Google Sheets:', error);
    }
  }
}
