import { Request, Response } from 'express';
import { prisma, io } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';
import { GoogleSheetsService } from '../services/google-sheets.service';

export const listProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      search,
      category,
      lowStock,
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Record<string, unknown> = { active: true };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.product.count({ where }),
    ]);

    const filteredProducts = lowStock === 'true'
      ? products.filter((p) => p.stock <= p.minStock)
      : products;

    res.json({
      data: filteredProducts,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error('listProducts error:', error);
    res.status(500).json({ error: 'Failed to list products' });
  }
};

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        stockMovements: {
          take: 20,
          orderBy: { date: 'desc' },
          include: { user: { select: { name: true } } },
        },
        supplierProducts: {
          include: { supplier: { select: { name: true, avgDeliveryDays: true } } },
        },
      },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(product);
  } catch (error) {
    logger.error('getProduct error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
};

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, sku, description, price, cost, stock, minStock, supplyDays, category } = req.body;

    if (!name || !sku || price === undefined) {
      res.status(400).json({ error: 'Name, SKU, and price are required' });
      return;
    }

    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) {
      res.status(409).json({ error: 'SKU already exists' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        description,
        price: parseFloat(price),
        cost: cost ? parseFloat(cost) : 0,
        stock: parseInt(stock || '0'),
        minStock: parseInt(minStock || '5'),
        supplyDays: parseInt(supplyDays || '7'),
        category,
      },
    });

    res.status(201).json(product);
  } catch (error) {
    logger.error('createProduct error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, price, cost, minStock, supplyDays, category, active } = req.body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (cost !== undefined) updateData.cost = parseFloat(cost);
    if (minStock !== undefined) updateData.minStock = parseInt(minStock);
    if (supplyDays !== undefined) updateData.supplyDays = parseInt(supplyDays);
    if (category !== undefined) updateData.category = category;
    if (active !== undefined) updateData.active = active;

    const product = await prisma.product.update({ where: { id }, data: updateData });
    res.json(product);
  } catch (error) {
    logger.error('updateProduct error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const adjustStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { type, quantity, reason, reference } = req.body;

    if (!type || quantity === undefined || !reason) {
      res.status(400).json({ error: 'Type, quantity, and reason are required' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const qty = parseInt(quantity);
    const newStock =
      type === 'in'
        ? product.stock + qty
        : type === 'out'
          ? product.stock - qty
          : qty;

    if (newStock < 0) {
      res.status(400).json({ error: 'Insufficient stock' });
      return;
    }

    const [movement, updatedProduct] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          productId: id,
          type,
          quantity: qty,
          reason,
          userId: req.user!.id,
          reference,
        },
      }),
      prisma.product.update({
        where: { id },
        data: { stock: newStock },
      }),
    ]);

    // Alert if stock drops below minimum
    if (newStock <= updatedProduct.minStock) {
      await prisma.alert.create({
        data: {
          type: 'low_stock',
          message: `Stock bas: ${updatedProduct.name} - ${newStock} unités restantes (min: ${updatedProduct.minStock})`,
          severity: newStock === 0 ? 'critical' : 'warning',
          data: { productId: id, stock: newStock, minStock: updatedProduct.minStock },
        },
      });

      io.emit('alert:low_stock', {
        product: updatedProduct,
        stock: newStock,
      });
    }

    res.json({ movement, product: updatedProduct });
  } catch (error) {
    logger.error('adjustStock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
};

export const getStockMovements = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '50',
      productId,
      type,
      startDate,
      endDate,
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          product: { select: { name: true, sku: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    res.json({
      data: movements,
      pagination: { page: parseInt(page), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error('getStockMovements error:', error);
    res.status(500).json({ error: 'Failed to get stock movements' });
  }
};

export const syncGoogleSheets = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sheets = new GoogleSheetsService();
    const result = await sheets.syncStock();
    res.json(result);
  } catch (error) {
    logger.error('syncGoogleSheets error:', error);
    res.status(500).json({ error: 'Google Sheets sync failed' });
  }
};

export const getLowStockProducts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
        supplyDays: true,
        category: true,
        supplierProducts: {
          include: {
            supplier: { select: { name: true, avgDeliveryDays: true } },
          },
        },
      },
      orderBy: { stock: 'asc' },
    });

    const lowStock = products.filter((p) => p.stock <= p.minStock);
    res.json(lowStock);
  } catch (error) {
    logger.error('getLowStockProducts error:', error);
    res.status(500).json({ error: 'Failed to get low stock products' });
  }
};
