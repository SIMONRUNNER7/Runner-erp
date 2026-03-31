import { Request, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

export const listAutomations = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rules = await prisma.automationRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(rules);
  } catch (error) {
    logger.error('listAutomations error:', error);
    res.status(500).json({ error: 'Failed to list automations' });
  }
};

export const getAutomation = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await prisma.automationRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule) {
      res.status(404).json({ error: 'Automation rule not found' });
      return;
    }

    res.json(rule);
  } catch (error) {
    logger.error('getAutomation error:', error);
    res.status(500).json({ error: 'Failed to get automation' });
  }
};

export const createAutomation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, trigger, conditions, actions, active } = req.body;

    if (!name || !trigger || !conditions || !actions) {
      res.status(400).json({ error: 'Name, trigger, conditions, and actions are required' });
      return;
    }

    const rule = await prisma.automationRule.create({
      data: {
        name,
        trigger,
        conditions,
        actions,
        active: active !== false,
      },
    });

    res.status(201).json(rule);
  } catch (error) {
    logger.error('createAutomation error:', error);
    res.status(500).json({ error: 'Failed to create automation' });
  }
};

export const updateAutomation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, trigger, conditions, actions, active } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (trigger !== undefined) updateData.trigger = trigger;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (actions !== undefined) updateData.actions = actions;
    if (active !== undefined) updateData.active = active;

    const rule = await prisma.automationRule.update({ where: { id }, data: updateData });
    res.json(rule);
  } catch (error) {
    logger.error('updateAutomation error:', error);
    res.status(500).json({ error: 'Failed to update automation' });
  }
};

export const deleteAutomation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.automationRule.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteAutomation error:', error);
    res.status(500).json({ error: 'Failed to delete automation' });
  }
};

export const getSyncLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '50', service } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Record<string, unknown> = {};
    if (service) where.service = service;

    const [logs, total] = await Promise.all([
      prisma.syncLog.findMany({
        where,
        skip,
        take,
        orderBy: { runAt: 'desc' },
      }),
      prisma.syncLog.count({ where }),
    ]);

    res.json({
      data: logs,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error('getSyncLogs error:', error);
    res.status(500).json({ error: 'Failed to get sync logs' });
  }
};

export const triggerSync = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { service } = req.params;
    const validServices = ['shopify', 'vos-factures', 'google-sheets', 'all'];

    if (!validServices.includes(service)) {
      res.status(400).json({ error: `Invalid service. Valid: ${validServices.join(', ')}` });
      return;
    }

    // Trigger sync in background
    res.json({ success: true, message: `Sync triggered for ${service}` });

    // Execute async
    setImmediate(async () => {
      try {
        if (service === 'shopify' || service === 'all') {
          const { ShopifyService } = await import('../services/shopify.service');
          const shopify = new ShopifyService();
          await shopify.syncOrders();
          await shopify.syncProducts();
        }
        if (service === 'vos-factures' || service === 'all') {
          const { VosFacturesService } = await import('../services/vos-factures.service');
          const vf = new VosFacturesService();
          await vf.syncInvoices();
        }
        if (service === 'google-sheets' || service === 'all') {
          const { GoogleSheetsService } = await import('../services/google-sheets.service');
          const sheets = new GoogleSheetsService();
          await sheets.syncStock();
        }
      } catch (err) {
        logger.error(`Manual sync error for ${service}:`, err);
      }
    });
  } catch (error) {
    logger.error('triggerSync error:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
};
