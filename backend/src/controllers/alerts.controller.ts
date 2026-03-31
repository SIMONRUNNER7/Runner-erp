import { Request, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

export const listAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      severity,
      type,
      read,
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Record<string, unknown> = {};
    if (severity) where.severity = severity;
    if (type) where.type = type;
    if (read !== undefined) where.read = read === 'true';

    // Filter by user role - show relevant alerts
    where.OR = [
      { userId: req.user!.id },
      { userId: null }, // System-wide alerts
    ];

    const [alerts, total, unreadCount] = await Promise.all([
      prisma.alert.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true } },
        },
      }),
      prisma.alert.count({ where }),
      prisma.alert.count({
        where: {
          read: false,
          OR: [{ userId: req.user!.id }, { userId: null }],
        },
      }),
    ]);

    res.json({
      data: alerts,
      unreadCount,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error('listAlerts error:', error);
    res.status(500).json({ error: 'Failed to list alerts' });
  }
};

export const markAlertRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const alert = await prisma.alert.update({
      where: { id },
      data: { read: true },
    });
    res.json(alert);
  } catch (error) {
    logger.error('markAlertRead error:', error);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
};

export const markAllAlertsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.alert.updateMany({
      where: {
        read: false,
        OR: [{ userId: req.user!.id }, { userId: null }],
      },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('markAllAlertsRead error:', error);
    res.status(500).json({ error: 'Failed to mark alerts as read' });
  }
};

export const deleteAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.alert.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteAlert error:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await prisma.alert.count({
      where: {
        read: false,
        OR: [{ userId: req.user!.id }, { userId: null }],
      },
    });
    res.json({ count });
  } catch (error) {
    logger.error('getUnreadCount error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};

export const createAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, message, severity, userId, data } = req.body;

    const alert = await prisma.alert.create({
      data: {
        type,
        message,
        severity: severity || 'info',
        userId,
        data,
      },
    });

    res.status(201).json(alert);
  } catch (error) {
    logger.error('createAlert error:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
};
