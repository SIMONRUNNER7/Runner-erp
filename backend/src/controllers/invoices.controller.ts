import { Request, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';
import { VosFacturesService } from '../services/vos-factures.service';

export const listInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      clientId,
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
    if (clientId) where.clientId = clientId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          client: { select: { id: true, name: true, email: true } },
          order: { select: { id: true, shopifyNumber: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      data: invoices,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error('listInvoices error:', error);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
};

export const getInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        order: {
          include: { items: { include: { product: true } } },
        },
      },
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json(invoice);
  } catch (error) {
    logger.error('getInvoice error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
};

export const createInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { clientId, orderId, amount, taxAmount, dueDate, notes, currency } = req.body;

    if (!clientId || amount === undefined) {
      res.status(400).json({ error: 'Client and amount are required' });
      return;
    }

    const totalAmount = parseFloat(amount) + parseFloat(taxAmount || '0');
    const invoiceNumber = `INV-${Date.now()}`;

    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        orderId,
        amount: parseFloat(amount),
        taxAmount: parseFloat(taxAmount || '0'),
        totalAmount,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes,
        currency: currency || 'EUR',
        invoiceNumber,
      },
      include: {
        client: true,
      },
    });

    // Try to create in Vos Factures
    try {
      const vosFactures = new VosFacturesService();
      const vfInvoice = await vosFactures.createInvoice(invoice);
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { vosFacturesId: vfInvoice.id, pdfUrl: vfInvoice.pdf_url },
      });
    } catch (vfError) {
      logger.warn('Vos Factures invoice creation failed:', vfError);
    }

    res.status(201).json(invoice);
  } catch (error) {
    logger.error('createInvoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

export const updateInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, paidAt, dueDate, notes } = req.body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (paidAt) updateData.paidAt = new Date(paidAt);
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (notes !== undefined) updateData.notes = notes;

    if (status === 'paid' && !paidAt) {
      updateData.paidAt = new Date();
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { client: { select: { name: true } } },
    });

    res.json(invoice);
  } catch (error) {
    logger.error('updateInvoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
};

export const syncVosFactures = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const vosFactures = new VosFacturesService();
    const result = await vosFactures.syncInvoices();
    res.json(result);
  } catch (error) {
    logger.error('syncVosFactures error:', error);
    res.status(500).json({ error: 'Vos Factures sync failed' });
  }
};

export const sendPaymentReminder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const vosFactures = new VosFacturesService();
    await vosFactures.sendPaymentReminder(invoice.vosFacturesId || '', invoice.client.email || '');

    res.json({ success: true, message: 'Payment reminder sent' });
  } catch (error) {
    logger.error('sendPaymentReminder error:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
};

export const getInvoiceStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, paid, overdue, draft, monthRevenue] = await Promise.all([
      prisma.invoice.count({ where: { status: { not: 'cancelled' } } }),
      prisma.invoice.count({ where: { status: 'paid' } }),
      prisma.invoice.count({ where: { status: 'overdue' } }),
      prisma.invoice.count({ where: { status: 'draft' } }),
      prisma.invoice.aggregate({
        where: { createdAt: { gte: startOfMonth }, status: { not: 'cancelled' } },
        _sum: { totalAmount: true },
      }),
    ]);

    res.json({
      total,
      paid,
      overdue,
      draft,
      monthRevenue: monthRevenue._sum.totalAmount || 0,
    });
  } catch (error) {
    logger.error('getInvoiceStats error:', error);
    res.status(500).json({ error: 'Failed to get invoice stats' });
  }
};
