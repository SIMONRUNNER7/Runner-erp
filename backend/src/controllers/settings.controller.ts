import { Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';

const ROLES = ['president', 'commercial', 'production', 'achats', 'comptable'];
const MODULES = ['dashboard', 'orders', 'stock', 'production', 'invoices', 'clients', 'suppliers', 'alerts', 'settings'];

// Default permissions if not in DB yet
const DEFAULTS: Record<string, Record<string, string>> = {
  president:  { dashboard: 'write', orders: 'write', stock: 'write', production: 'write', invoices: 'write', clients: 'write', suppliers: 'write', alerts: 'write', settings: 'write' },
  commercial: { dashboard: 'read',  orders: 'write', stock: 'read',  production: 'none',  invoices: 'read',  clients: 'write', suppliers: 'none',  alerts: 'read',  settings: 'none' },
  production: { dashboard: 'read',  orders: 'read',  stock: 'write', production: 'write', invoices: 'none',  clients: 'none',  suppliers: 'read',  alerts: 'read',  settings: 'none' },
  achats:     { dashboard: 'read',  orders: 'read',  stock: 'write', production: 'none',  invoices: 'none',  clients: 'none',  suppliers: 'write', alerts: 'read',  settings: 'none' },
  comptable:  { dashboard: 'read',  orders: 'none',  stock: 'none',  production: 'none',  invoices: 'write', clients: 'read',  suppliers: 'none',  alerts: 'read',  settings: 'none' },
};

export const getPermissions = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.rolePermission.findMany();

    // Build matrix from DB, fallback to defaults for missing entries
    const matrix: Record<string, Record<string, string>> = {};
    for (const role of ROLES) {
      matrix[role] = {};
      for (const mod of MODULES) {
        matrix[role][mod] = DEFAULTS[role]?.[mod] || 'none';
      }
    }
    for (const row of rows) {
      if (!matrix[row.role]) matrix[row.role] = {};
      matrix[row.role][row.module] = row.level;
    }

    res.json(matrix);
  } catch (error) {
    logger.error('getPermissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
};

export const updatePermissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Body: { president: { dashboard: 'write', orders: 'read', ... }, ... }
    const matrix: Record<string, Record<string, string>> = req.body;

    const upserts = [];
    for (const role of Object.keys(matrix)) {
      for (const module of Object.keys(matrix[role])) {
        const level = matrix[role][module];
        upserts.push(
          prisma.rolePermission.upsert({
            where: { role_module: { role, module } },
            update: { level },
            create: { role, module, level },
          })
        );
      }
    }

    await Promise.all(upserts);
    res.json({ success: true });
  } catch (error) {
    logger.error('updatePermissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
};
