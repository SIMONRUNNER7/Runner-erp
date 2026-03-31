import { Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.user!.role;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    if (role === 'president') {
      const [
        totalOrders,
        monthOrders,
        monthRevenue,
        lastMonthRevenue,
        overdueInvoices,
        stockValue,
        topProducts,
        recentOrders,
        salesByMonth,
      ] = await Promise.all([
        prisma.order.count({ where: { status: { not: 'cancelled' } } }),
        prisma.order.count({
          where: { createdAt: { gte: startOfMonth }, status: { not: 'cancelled' } },
        }),
        prisma.order.aggregate({
          where: { createdAt: { gte: startOfMonth }, status: { not: 'cancelled' } },
          _sum: { total: true },
        }),
        prisma.order.aggregate({
          where: {
            createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
            status: { not: 'cancelled' },
          },
          _sum: { total: true },
        }),
        prisma.invoice.count({
          where: { status: 'overdue' },
        }),
        prisma.product.aggregate({ _sum: { stock: true } }),
        prisma.orderItem.groupBy({
          by: ['productId'],
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 5,
        }),
        prisma.order.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { client: { select: { name: true } } },
        }),
        getSalesByMonth(),
      ]);

      const productIds = topProducts.map((p) => p.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      });

      const topProductsWithNames = topProducts.map((p) => ({
        ...p,
        product: products.find((prod) => prod.id === p.productId),
      }));

      const currentRevenue = monthRevenue._sum.total || 0;
      const lastRevenue = lastMonthRevenue._sum.total || 0;
      const revenueGrowth =
        lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;

      res.json({
        role,
        kpis: {
          totalOrders,
          monthOrders,
          monthRevenue: currentRevenue,
          revenueGrowth: Math.round(revenueGrowth * 100) / 100,
          overdueInvoices,
          stockProductCount: stockValue._sum.stock || 0,
        },
        charts: {
          salesByMonth,
          topProducts: topProductsWithNames,
        },
        recentOrders,
      });
    } else if (role === 'commercial') {
      const [openOrders, pendingOrders, clientCount, monthRevenue, conversionData] =
        await Promise.all([
          prisma.order.count({ where: { status: { in: ['pending', 'confirmed'] } } }),
          prisma.order.count({ where: { status: 'pending' } }),
          prisma.client.count(),
          prisma.order.aggregate({
            where: { createdAt: { gte: startOfMonth }, status: { not: 'cancelled' } },
            _sum: { total: true },
          }),
          getSalesByMonth(),
        ]);

      res.json({
        role,
        kpis: {
          openOrders,
          pendingOrders,
          clientCount,
          monthRevenue: monthRevenue._sum.total || 0,
        },
        charts: {
          salesByMonth: conversionData,
        },
      });
    } else if (role === 'production') {
      const [inProduction, stockAlerts, pendingOrders] = await Promise.all([
        prisma.order.count({ where: { status: 'in_production' } }),
        prisma.product.count(),
        prisma.order.count({ where: { status: 'confirmed' } }),
      ]);

      const lowStockProducts = await prisma.product.findMany({
        where: { active: true },
        select: { id: true, name: true, sku: true, stock: true, minStock: true },
        orderBy: { stock: 'asc' },
        take: 10,
      });

      const actualLowStock = lowStockProducts.filter((p) => p.stock <= p.minStock);

      res.json({
        role,
        kpis: {
          inProduction,
          stockAlerts: actualLowStock.length,
          pendingOrders,
        },
        lowStockProducts: actualLowStock,
      });
    } else if (role === 'achats') {
      const [pendingPOs, suppliers, lowStockCount] = await Promise.all([
        prisma.purchaseOrder.count({ where: { status: { in: ['draft', 'sent', 'confirmed'] } } }),
        prisma.supplier.count({ where: { active: true } }),
        prisma.product.count({ where: { active: true } }),
      ]);

      const products = await prisma.product.findMany({
        where: { active: true },
        select: { id: true, name: true, sku: true, stock: true, minStock: true, supplyDays: true },
      });
      const needReplenishment = products.filter((p) => p.stock <= p.minStock);

      res.json({
        role,
        kpis: {
          pendingPOs,
          suppliers,
          replenishmentNeeded: needReplenishment.length,
          totalProducts: lowStockCount,
        },
        replenishmentList: needReplenishment,
      });
    } else if (role === 'comptable') {
      const [monthRevenue, unpaidInvoices, overdueInvoices, paidThisMonth] = await Promise.all([
        prisma.invoice.aggregate({
          where: { createdAt: { gte: startOfMonth }, status: { not: 'cancelled' } },
          _sum: { totalAmount: true },
        }),
        prisma.invoice.count({ where: { status: { in: ['sent', 'overdue'] } } }),
        prisma.invoice.count({ where: { status: 'overdue' } }),
        prisma.invoice.aggregate({
          where: { paidAt: { gte: startOfMonth }, status: 'paid' },
          _sum: { totalAmount: true },
        }),
      ]);

      const recentInvoices = await prisma.invoice.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { name: true } } },
      });

      res.json({
        role,
        kpis: {
          monthRevenue: monthRevenue._sum.totalAmount || 0,
          unpaidInvoices,
          overdueInvoices,
          paidThisMonth: paidThisMonth._sum.totalAmount || 0,
        },
        recentInvoices,
      });
    } else {
      res.json({ role, kpis: {}, message: 'Unknown role' });
    }
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

async function getSalesByMonth(): Promise<{ month: string; revenue: number; orders: number }[]> {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const result = await prisma.order.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: 'cancelled' },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    months.push({
      month: start.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      revenue: result._sum.total || 0,
      orders: result._count.id || 0,
    });
  }

  return months;
}
