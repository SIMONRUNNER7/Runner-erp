import axios, { AxiosInstance } from 'axios';
import { prisma } from '../index';
import logger from '../lib/logger';
import { Invoice, Client, Order, OrderItem, Product } from '@prisma/client';

interface VFInvoice {
  id: string;
  number: string;
  status: string;
  price_gross: number;
  price_net: number;
  price_tax: number;
  tax: string;
  issue_date: string;
  payment_date?: string;
  payment_to?: string;
  client_id: string;
  pdf_url?: string;
  buyer_name: string;
  buyer_email: string;
  positions: VFPosition[];
}

interface VFPosition {
  name: string;
  quantity: number;
  unit_net_price: number;
  tax: string;
  total_price_gross: number;
}

interface VFClient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  street?: string;
  city?: string;
  country?: string;
}

type OrderWithDetails = Order & {
  client: Client;
  items: (OrderItem & { product: Product })[];
};

type InvoiceWithClient = Invoice & { client: Client };

export class VosFacturesService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.VOS_FACTURES_BASE_URL || 'https://www.vosFactures.com/api/v1';
    const token = process.env.VOS_FACTURES_API_TOKEN || '';

    this.client = axios.create({
      baseURL: this.baseUrl,
      params: { api_token: token },
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 30000,
    });
  }

  async syncInvoices(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      const response = await this.client.get('/invoices.json', {
        params: { per_page: 100, page: 1 },
      });

      const vfInvoices: VFInvoice[] = response.data;

      for (const vfInvoice of vfInvoices) {
        try {
          const status = this.mapStatus(vfInvoice.status);

          const priceNet = parseFloat(String(vfInvoice.price_net)) || 0;
          const priceTax = parseFloat(String(vfInvoice.price_tax)) || 0;
          const priceGross = parseFloat(String(vfInvoice.price_gross)) || priceNet + priceTax;

          await prisma.invoice.upsert({
            where: { vosFacturesId: String(vfInvoice.id) },
            update: {
              status,
              amount: priceNet,
              taxAmount: priceTax,
              totalAmount: priceGross,
              paidAt: vfInvoice.payment_date ? new Date(vfInvoice.payment_date) : null,
              dueDate: vfInvoice.payment_to ? new Date(vfInvoice.payment_to) : null,
              pdfUrl: vfInvoice.pdf_url || null,
            },
            create: await this.buildInvoiceCreateData(vfInvoice),
          });
          synced++;
        } catch (err) {
          logger.error(`Failed to sync VF invoice ${vfInvoice.id}:`, err);
          errors++;
        }
      }

      await prisma.syncLog.create({
        data: {
          service: 'vos_factures',
          status: errors === 0 ? 'success' : 'partial',
          recordsProcessed: synced,
          error: errors > 0 ? `${errors} invoices failed` : null,
        },
      });

      return { synced, errors };
    } catch (error) {
      logger.error('Vos Factures sync failed:', error);
      await prisma.syncLog.create({
        data: {
          service: 'vos_factures',
          status: 'failure',
          recordsProcessed: synced,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private async buildInvoiceCreateData(vfInvoice: VFInvoice) {
    // Find or create client
    let client = await prisma.client.findFirst({
      where: { name: vfInvoice.buyer_name },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          vosFacturesId: String(vfInvoice.client_id),
          name: vfInvoice.buyer_name,
          email: vfInvoice.buyer_email || null,
        },
      });
    } else if (!client.vosFacturesId) {
      await prisma.client.update({
        where: { id: client.id },
        data: { vosFacturesId: String(vfInvoice.client_id) },
      });
    }

    const priceNet = parseFloat(String(vfInvoice.price_net)) || 0;
    const priceTax = parseFloat(String(vfInvoice.price_tax)) || 0;
    const priceGross = parseFloat(String(vfInvoice.price_gross)) || priceNet + priceTax;

    return {
      vosFacturesId: String(vfInvoice.id),
      invoiceNumber: vfInvoice.number,
      clientId: client.id,
      amount: priceNet,
      taxAmount: priceTax,
      totalAmount: priceGross,
      status: this.mapStatus(vfInvoice.status),
      dueDate: vfInvoice.payment_to ? new Date(vfInvoice.payment_to) : null,
      paidAt: vfInvoice.payment_date ? new Date(vfInvoice.payment_date) : null,
      pdfUrl: vfInvoice.pdf_url || null,
    };
  }

  async createInvoice(invoice: Invoice & { client?: Client }): Promise<{ id: string; pdf_url?: string }> {
    try {
      const payload = {
        invoice: {
          kind: 'vat',
          number: invoice.invoiceNumber,
          issue_date: new Date(invoice.createdAt).toISOString().split('T')[0],
          payment_to: invoice.dueDate
            ? new Date(invoice.dueDate).toISOString().split('T')[0]
            : null,
          buyer_name: invoice.client?.name || 'Client',
          buyer_email: invoice.client?.email || null,
          price_net: invoice.amount,
          tax: invoice.taxAmount,
          currency: invoice.currency,
          positions: [
            {
              name: `Facture ${invoice.invoiceNumber}`,
              quantity: 1,
              unit_net_price: invoice.amount,
              tax: '20',
            },
          ],
        },
      };

      const response = await this.client.post('/invoices.json', payload);
      return response.data;
    } catch (error) {
      logger.error('VF createInvoice error:', error);
      throw error;
    }
  }

  async createInvoiceFromOrder(order: OrderWithDetails): Promise<Invoice> {
    try {
      const positions = order.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unit_net_price: item.unitPrice,
        tax: '20',
        total_price_gross: item.total * 1.2,
      }));

      const payload = {
        invoice: {
          kind: 'vat',
          issue_date: new Date().toISOString().split('T')[0],
          payment_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          buyer_name: order.client.name,
          buyer_email: order.client.email || null,
          currency: order.currency,
          positions,
        },
      };

      const response = await this.client.post('/invoices.json', payload);
      const vfData = response.data;

      const taxAmount = order.total * 0.2;
      const totalAmount = order.total + taxAmount;
      const invoiceNumber = `INV-${order.shopifyNumber || order.id.slice(0, 8)}-${Date.now()}`;

      const invoice = await prisma.invoice.create({
        data: {
          vosFacturesId: String(vfData.id),
          invoiceNumber,
          orderId: order.id,
          clientId: order.clientId,
          amount: order.total,
          taxAmount,
          totalAmount,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          pdfUrl: vfData.pdf_url || null,
          currency: order.currency,
        },
      });

      return invoice;
    } catch (error) {
      logger.error('VF createInvoiceFromOrder error:', error);
      throw error;
    }
  }

  async sendPaymentReminder(vosFacturesId: string, clientEmail: string): Promise<void> {
    try {
      if (!vosFacturesId) {
        throw new Error('No Vos Factures ID for this invoice');
      }

      await this.client.post(`/invoices/${vosFacturesId}/send_by_email.json`, {
        invoice: {
          send_email: true,
          email_to: clientEmail,
        },
      });

      logger.info(`Payment reminder sent for VF invoice ${vosFacturesId} to ${clientEmail}`);
    } catch (error) {
      logger.error('VF sendPaymentReminder error:', error);
      throw error;
    }
  }

  async syncClients(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      const response = await this.client.get('/clients.json', {
        params: { per_page: 100 },
      });

      const vfClients: VFClient[] = response.data;

      for (const vfClient of vfClients) {
        try {
          await prisma.client.upsert({
            where: { vosFacturesId: String(vfClient.id) },
            update: {
              name: vfClient.name,
              email: vfClient.email || null,
              phone: vfClient.phone || null,
            },
            create: {
              vosFacturesId: String(vfClient.id),
              name: vfClient.name,
              email: vfClient.email || null,
              phone: vfClient.phone || null,
              address: vfClient.street || null,
              city: vfClient.city || null,
              country: vfClient.country || 'France',
            },
          });
          synced++;
        } catch (err) {
          logger.error(`Failed to sync VF client ${vfClient.id}:`, err);
          errors++;
        }
      }

      return { synced, errors };
    } catch (error) {
      logger.error('VF clients sync failed:', error);
      throw error;
    }
  }

  private mapStatus(
    vfStatus: string
  ): 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' {
    switch (vfStatus) {
      case 'issued':
        return 'draft';
      case 'sent':
        return 'sent';
      case 'paid':
        return 'paid';
      case 'partial':
        return 'sent';
      case 'rejected':
        return 'cancelled';
      default:
        return 'draft';
    }
  }
}
