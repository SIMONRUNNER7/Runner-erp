import { Request, Response } from 'express';
import { prisma } from '../index';
import { resolveComponents, ALL_COMPONENTS } from '../services/recipe.service';
import { GoogleSheetsService } from '../services/google-sheets.service';
import logger from '../lib/logger';

// GET /components — list all components with stock
export const listComponents = async (_req: Request, res: Response): Promise<void> => {
  try {
    const components = await prisma.component.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(components);
  } catch (error) {
    logger.error('listComponents error:', error);
    res.status(500).json({ error: 'Failed to list components' });
  }
};

// PUT /components/:id — update stock
export const updateComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stock, minStock, unitCost } = req.body;
    const component = await prisma.component.update({
      where: { id: req.params.id },
      data: {
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(minStock !== undefined && { minStock: parseInt(minStock) }),
        ...(unitCost !== undefined && { unitCost: parseFloat(unitCost) }),
      },
    });
    res.json(component);
  } catch (error) {
    logger.error('updateComponent error:', error);
    res.status(500).json({ error: 'Failed to update component' });
  }
};

// POST /components/seed — upsert all 43 canonical components
export const seedComponents = async (_req: Request, res: Response): Promise<void> => {
  try {
    let created = 0;
    for (const comp of ALL_COMPONENTS) {
      await prisma.component.upsert({
        where: { sku: comp.sku },
        update: { name: comp.name, category: comp.category },
        create: { sku: comp.sku, name: comp.name, category: comp.category },
      });
      created++;
    }
    res.json({ seeded: created });
  } catch (error) {
    logger.error('seedComponents error:', error);
    res.status(500).json({ error: 'Failed to seed components' });
  }
};

// GET /production/orders/:row/bom — resolve BOM + check stock
export const getProductionBOM = async (req: Request, res: Response): Promise<void> => {
  try {
    const rowIndex = parseInt(req.params.row);
    const sheets = new GoogleSheetsService();
    const orders = await sheets.readProductionOrders();
    const order = orders.find((o) => o._rowIndex === String(rowIndex));

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const getVal = (key: string) => {
      if (order[key] !== undefined) return order[key];
      const norm = key.replace(/\n/g, ' ').toLowerCase().trim();
      const match = Object.keys(order).find(
        (k) => k.replace(/\n/g, ' ').toLowerCase().trim() === norm
      );
      return match ? order[match] : '';
    };

    const bomItems = resolveComponents({
      modele:  getVal('MODELE'),
      couleur: getVal('COULEUR'),
      face:    getVal('FACE'),
      mire:    getVal('MIRE'),
      centre:  getVal('CENTRE'),
      offset:  getVal('OFFSET'),
      shaft:   getVal('SHAFT'),
      grip:    getVal('GRIP'),
      poids:   getVal('POIDS'),
    });

    // Enrich with current stock
    const skus = bomItems.map((i) => i.sku);
    const components = await prisma.component.findMany({
      where: { sku: { in: skus } },
    });
    const stockMap = Object.fromEntries(components.map((c) => [c.sku, c.stock]));

    const bom = bomItems.map((item) => ({
      ...item,
      stock:     stockMap[item.sku] ?? null, // null = component not in DB yet
      available: stockMap[item.sku] !== undefined && stockMap[item.sku] >= item.qty,
    }));

    const canProduce = bom.every((b) => b.available);
    res.json({ bom, canProduce });
  } catch (error) {
    logger.error('getProductionBOM error:', error);
    res.status(500).json({ error: 'Failed to resolve BOM' });
  }
};

// POST /production/orders/:row/consume — deduct components from stock
export const consumeComponents = async (req: Request, res: Response): Promise<void> => {
  try {
    const rowIndex = parseInt(req.params.row);
    const sheets = new GoogleSheetsService();
    const orders = await sheets.readProductionOrders();
    const order = orders.find((o) => o._rowIndex === String(rowIndex));

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const getVal = (key: string) => {
      if (order[key] !== undefined) return order[key];
      const norm = key.replace(/\n/g, ' ').toLowerCase().trim();
      const match = Object.keys(order).find(
        (k) => k.replace(/\n/g, ' ').toLowerCase().trim() === norm
      );
      return match ? order[match] : '';
    };

    const bomItems = resolveComponents({
      modele:  getVal('MODELE'),
      couleur: getVal('COULEUR'),
      face:    getVal('FACE'),
      mire:    getVal('MIRE'),
      centre:  getVal('CENTRE'),
      offset:  getVal('OFFSET'),
      shaft:   getVal('SHAFT'),
      grip:    getVal('GRIP'),
      poids:   getVal('POIDS'),
    });

    const ref = getVal('COMMANDE') || `Ligne ${rowIndex}`;

    for (const item of bomItems) {
      const component = await prisma.component.findUnique({ where: { sku: item.sku } });
      if (!component) continue;

      await prisma.component.update({
        where: { sku: item.sku },
        data: { stock: { decrement: item.qty } },
      });

      await prisma.componentMovement.create({
        data: {
          componentId: component.id,
          type:        'out',
          quantity:    item.qty,
          reason:      `Production ${ref}`,
          reference:   ref,
        },
      });
    }

    // Mark as assembled in Google Sheet
    await sheets.updateProductionRow(rowIndex, 'ASSEMBLAGE', 'OUI');

    res.json({ success: true, consumed: bomItems.length });
  } catch (error) {
    logger.error('consumeComponents error:', error);
    res.status(500).json({ error: 'Failed to consume components' });
  }
};
