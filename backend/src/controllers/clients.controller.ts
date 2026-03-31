import { Request, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

export const listClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      search,
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { orders: true, invoices: true },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    res.json({
      data: clients,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error('listClients error:', error);
    res.status(500).json({ error: 'Failed to list clients' });
  }
};

export const getClient = async (req: Request, res: Response): Promise<void> => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json(client);
  } catch (error) {
    logger.error('getClient error:', error);
    res.status(500).json({ error: 'Failed to get client' });
  }
};

export const createClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, phone, address, city, country } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const client = await prisma.client.create({
      data: { name, email, phone, address, city, country },
    });

    res.status(201).json(client);
  } catch (error) {
    logger.error('createClient error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
};

export const updateClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, city, country } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (country !== undefined) updateData.country = country;

    const client = await prisma.client.update({ where: { id }, data: updateData });
    res.json(client);
  } catch (error) {
    logger.error('updateClient error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
};

export const deleteClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.client.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteClient error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
};

export const getClientHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [orders, invoices, stats] = await Promise.all([
      prisma.order.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: { select: { name: true } } } },
        },
      }),
      prisma.invoice.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.aggregate({
        where: { clientId: id, status: { not: 'cancelled' } },
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    res.json({
      orders,
      invoices,
      stats: {
        totalOrders: stats._count.id,
        totalRevenue: stats._sum.total || 0,
      },
    });
  } catch (error) {
    logger.error('getClientHistory error:', error);
    res.status(500).json({ error: 'Failed to get client history' });
  }
};
