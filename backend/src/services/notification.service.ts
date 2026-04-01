import nodemailer from 'nodemailer';
import { prisma, io } from '../index';
import logger from '../lib/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface AlertOptions {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  userId?: string;
  data?: string;
}

export class NotificationService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@runner-erp.com',
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      logger.info(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      logger.error('Email send error:', error);
      throw error;
    }
  }

  async createAlert(options: AlertOptions): Promise<void> {
    try {
      const alert = await prisma.alert.create({
        data: {
          type: options.type,
          message: options.message,
          severity: options.severity,
          userId: options.userId || null,
          data: options.data ?? undefined,
        },
      });

      // Emit real-time alert
      io.emit('alert:new', alert);

      logger.info(`Alert created: ${options.type} - ${options.message}`);
    } catch (error) {
      logger.error('Create alert error:', error);
    }
  }

  async notifyLowStock(productId: string, productName: string, stock: number, minStock: number): Promise<void> {
    // Create in-app alert
    await this.createAlert({
      type: 'low_stock',
      message: `Stock bas: ${productName} - ${stock} unités (minimum: ${minStock})`,
      severity: stock === 0 ? 'critical' : 'warning',
      data: { productId, stock, minStock },
    });

    // Find achats users
    const achatUsers = await prisma.user.findMany({
      where: { role: { in: ['achats', 'production'] }, active: true },
      select: { email: true, name: true },
    });

    if (achatUsers.length > 0) {
      const emails = achatUsers.map((u) => u.email).filter(Boolean) as string[];
      if (emails.length > 0) {
        await this.sendEmail({
          to: emails,
          subject: `[RUNNER ERP] Alerte Stock: ${productName}`,
          html: this.buildLowStockEmail(productName, stock, minStock),
        });
      }
    }
  }

  async notifyOverdueInvoice(invoiceId: string, invoiceNumber: string, clientName: string, amount: number, dueDate: Date): Promise<void> {
    await this.createAlert({
      type: 'overdue_invoice',
      message: `Facture en retard: ${invoiceNumber} - ${clientName} - ${amount}€`,
      severity: 'warning',
      data: { invoiceId, invoiceNumber, clientName, amount },
    });

    const presidentEmail = process.env.PRESIDENT_EMAIL;
    const comptableUsers = await prisma.user.findMany({
      where: { role: { in: ['comptable', 'president'] }, active: true },
      select: { email: true },
    });

    const emails = [...new Set([
      ...(presidentEmail ? [presidentEmail] : []),
      ...comptableUsers.map((u) => u.email).filter(Boolean) as string[],
    ])];

    if (emails.length > 0) {
      await this.sendEmail({
        to: emails,
        subject: `[RUNNER ERP] Facture en retard: ${invoiceNumber}`,
        html: this.buildOverdueInvoiceEmail(invoiceNumber, clientName, amount, dueDate),
      });
    }
  }

  async sendWeeklyReport(data: {
    weekRevenue: number;
    weekOrders: number;
    overdueInvoices: number;
    lowStockCount: number;
    topProducts: Array<{ name: string; revenue: number }>;
  }): Promise<void> {
    const presidentEmail = process.env.PRESIDENT_EMAIL;
    if (!presidentEmail) {
      logger.warn('No president email configured for weekly report');
      return;
    }

    await this.sendEmail({
      to: presidentEmail,
      subject: `[RUNNER ERP] Rapport Hebdomadaire - ${new Date().toLocaleDateString('fr-FR')}`,
      html: this.buildWeeklyReportEmail(data),
    });
  }

  async notifyNewShopifyOrder(orderNumber: string, total: number, clientName: string): Promise<void> {
    await this.createAlert({
      type: 'new_shopify_order',
      message: `Nouvelle commande Shopify ${orderNumber} - ${clientName} - ${total}€`,
      severity: 'info',
      data: { orderNumber, total, clientName },
    });
  }

  private buildLowStockEmail(productName: string, stock: number, minStock: number): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2>⚠️ Alerte Stock Bas - RUNNER ERP</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Le produit <strong>${productName}</strong> est en dessous du stock minimum.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #f3f4f6;">
              <td style="padding: 8px; border: 1px solid #e5e7eb;">Stock actuel</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; color: ${stock === 0 ? 'red' : 'orange'}; font-weight: bold;">${stock} unités</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">Stock minimum</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${minStock} unités</td>
            </tr>
          </table>
          <p>Veuillez passer une commande fournisseur dès que possible.</p>
          <a href="${process.env.FRONTEND_URL}/stock" style="background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Voir le stock</a>
        </div>
      </div>
    `;
  }

  private buildOverdueInvoiceEmail(invoiceNumber: string, clientName: string, amount: number, dueDate: Date): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2>🔴 Facture en Retard - RUNNER ERP</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>La facture suivante est en retard de paiement:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #f3f4f6;">
              <td style="padding: 8px; border: 1px solid #e5e7eb;">Numéro</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>${invoiceNumber}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">Client</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${clientName}</td>
            </tr>
            <tr style="background: #f3f4f6;">
              <td style="padding: 8px; border: 1px solid #e5e7eb;">Montant</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb; color: red; font-weight: bold;">${amount.toFixed(2)} EUR</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">Échéance</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${dueDate.toLocaleDateString('fr-FR')}</td>
            </tr>
          </table>
          <a href="${process.env.FRONTEND_URL}/invoices" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Voir les factures</a>
        </div>
      </div>
    `;
  }

  private buildWeeklyReportEmail(data: {
    weekRevenue: number;
    weekOrders: number;
    overdueInvoices: number;
    lowStockCount: number;
    topProducts: Array<{ name: string; revenue: number }>;
  }): string {
    const topProductsHtml = data.topProducts
      .map((p, i) => `<tr ${i % 2 === 0 ? 'style="background:#f3f4f6;"' : ''}><td style="padding:8px;border:1px solid #e5e7eb;">${p.name}</td><td style="padding:8px;border:1px solid #e5e7eb;">${p.revenue.toFixed(2)} €</td></tr>`)
      .join('');

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e3a5f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2>📊 Rapport Hebdomadaire - RUNNER ERP</h2>
          <p>${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h3>Résumé de la semaine</h3>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f3f4f6;"><td style="padding:8px;border:1px solid #e5e7eb;">Chiffre d'affaires</td><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;color:#16a34a;">${data.weekRevenue.toFixed(2)} €</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;">Commandes</td><td style="padding:8px;border:1px solid #e5e7eb;">${data.weekOrders}</td></tr>
            <tr style="background:#f3f4f6;"><td style="padding:8px;border:1px solid #e5e7eb;">Factures en retard</td><td style="padding:8px;border:1px solid #e5e7eb;color:${data.overdueInvoices > 0 ? 'red' : 'green'};">${data.overdueInvoices}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;">Produits stock bas</td><td style="padding:8px;border:1px solid #e5e7eb;color:${data.lowStockCount > 0 ? 'orange' : 'green'};">${data.lowStockCount}</td></tr>
          </table>
          ${data.topProducts.length > 0 ? `
            <h3>Top Produits</h3>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr style="background:#1e3a5f;color:white;"><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Produit</th><th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">CA</th></tr>
              ${topProductsHtml}
            </table>
          ` : ''}
          <a href="${process.env.FRONTEND_URL}/dashboard" style="background:#1e3a5f;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;">Voir le tableau de bord</a>
        </div>
      </div>
    `;
  }
}
