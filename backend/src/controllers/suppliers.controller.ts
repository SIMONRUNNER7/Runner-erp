import { Request, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

export const listSuppliers = async (req: Request, res: Response): Promise<void> => {
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

    const where: Record<string, unknown> = { active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { products: true, purchaseOrders: true },
          },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    res.json({
      data: suppliers,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error('listSuppliers error:', error);
    res.status(500).json({ error: 'Failed to list suppliers' });
  }
};

export const getSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        products: {
          include: { product: { select: { name: true, sku: true, stock: true } } },
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            items: { include: { product: { select: { name: true } } } },
          },
        },
      },
    });

    if (!supplier) {
      res.status(404).json({ error: 'Supplier not found' });
      return;
    }

    res.json(supplier);
  } catch (error) {
    logger.error('getSupplier error:', error);
    res.status(500).json({ error: 'Failed to get supplier' });
  }
};

export const createSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, phone, address, contactName, avgDeliveryDays, notes } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        email,
        phone,
        address,
        contactName,
        avgDeliveryDays: avgDeliveryDays ? parseInt(avgDeliveryDays) : 7,
        notes,
      },
    });

    res.status(201).json(supplier);
  } catch (error) {
    logger.error('createSupplier error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
};

export const updateSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, contactName, avgDeliveryDays, rating, active, notes } =
      req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (contactName !== undefined) updateData.contactName = contactName;
    if (avgDeliveryDays !== undefined) updateData.avgDeliveryDays = parseInt(avgDeliveryDays);
    if (rating !== undefined) updateData.rating = parseFloat(rating);
    if (active !== undefined) updateData.active = active;
    if (notes !== undefined) updateData.notes = notes;

    const supplier = await prisma.supplier.update({ where: { id }, data: updateData });
    res.json(supplier);
  } catch (error) {
    logger.error('updateSupplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
};

export const deleteSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.supplier.update({ where: { id }, data: { active: false } });
    res.json({ success: true });
  } catch (error) {
    logger.error('deleteSupplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
};

// Purchase Orders
export const listPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      supplierId,
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { name: true } },
          items: {
            include: { product: { select: { name: true, sku: true } } },
          },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    res.json({
      data: orders,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error('listPurchaseOrders error:', error);
    res.status(500).json({ error: 'Failed to list purchase orders' });
  }
};

export const createPurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supplierId, items, notes, expectedDate } = req.body;

    if (!supplierId || !items || !items.length) {
      res.status(400).json({ error: 'Supplier and items are required' });
      return;
    }

    let total = 0;
    const orderItems = items.map((item: { productId: string; quantity: number; unitCost: number }) => {
      const itemTotal = item.unitCost * item.quantity;
      total += itemTotal;
      return {
        productId: item.productId,
        quantity: parseInt(String(item.quantity)),
        unitCost: parseFloat(String(item.unitCost)),
        total: itemTotal,
      };
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        total,
        notes,
        expectedDate: expectedDate ? new Date(expectedDate) : undefined,
        items: { create: orderItems },
      },
      include: {
        supplier: true,
        items: { include: { product: { select: { name: true } } } },
      },
    });

    res.status(201).json(po);
  } catch (error) {
    logger.error('createPurchaseOrder error:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
};

export const updatePurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, expectedDate, receivedDate, notes } = req.body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (expectedDate) updateData.expectedDate = new Date(expectedDate);
    if (receivedDate) updateData.receivedDate = new Date(receivedDate);
    if (notes !== undefined) updateData.notes = notes;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po) {
      res.status(404).json({ error: 'Purchase order not found' });
      return;
    }

    const updated = await prisma.purchaseOrder.update({ where: { id }, data: updateData });

    // If received, update stock
    if (status === 'received' && po.status !== 'received') {
      for (const item of po.items) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await prisma.$transaction([
            prisma.product.update({
              where: { id: item.productId },
              data: { stock: product.stock + item.quantity },
            }),
            prisma.stockMovement.create({
              data: {
                productId: item.productId,
                type: 'in',
                quantity: item.quantity,
                reason: `Bon de commande reçu #${id.slice(0, 8)}`,
                reference: id,
              },
            }),
          ]);
        }
      }
    }

    res.json(updated);
  } catch (error) {
    logger.error('updatePurchaseOrder error:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
};
