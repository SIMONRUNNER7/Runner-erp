import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export type Role = 'president' | 'commercial' | 'production' | 'achats' | 'comptable';

export const rolePermissions: Record<string, Role[]> = {
  // Auth
  'GET /api/auth/me': ['president', 'commercial', 'production', 'achats', 'comptable'],

  // Dashboard
  'GET /api/dashboard': ['president', 'commercial', 'production', 'achats', 'comptable'],

  // Orders
  'GET /api/orders': ['president', 'commercial', 'production', 'achats'],
  'POST /api/orders': ['president', 'commercial'],
  'PUT /api/orders': ['president', 'commercial', 'production'],
  'DELETE /api/orders': ['president'],

  // Stock
  'GET /api/stock': ['president', 'commercial', 'production', 'achats'],
  'POST /api/stock': ['president', 'production', 'achats'],
  'PUT /api/stock': ['president', 'production', 'achats'],

  // Invoices
  'GET /api/invoices': ['president', 'commercial', 'comptable'],
  'POST /api/invoices': ['president', 'comptable'],
  'PUT /api/invoices': ['president', 'comptable'],

  // Clients
  'GET /api/clients': ['president', 'commercial', 'comptable'],
  'POST /api/clients': ['president', 'commercial'],
  'PUT /api/clients': ['president', 'commercial'],

  // Suppliers
  'GET /api/suppliers': ['president', 'achats', 'production'],
  'POST /api/suppliers': ['president', 'achats'],
  'PUT /api/suppliers': ['president', 'achats'],
  'DELETE /api/suppliers': ['president'],

  // Alerts
  'GET /api/alerts': ['president', 'commercial', 'production', 'achats', 'comptable'],
  'PUT /api/alerts': ['president', 'commercial', 'production', 'achats', 'comptable'],

  // Automations
  'GET /api/automations': ['president'],
  'POST /api/automations': ['president'],
  'PUT /api/automations': ['president'],
  'DELETE /api/automations': ['president'],

  // Settings
  'GET /api/settings': ['president'],
  'POST /api/settings': ['president'],
};

export const requireRole = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role as Role;
    if (!roles.includes(userRole)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: userRole,
      });
      return;
    }

    next();
  };
};

export const requireAnyRole = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
};
