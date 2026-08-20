import { Router } from 'express';
import authRoutes from './auth.routes';
import settingsRoutes from './settings.routes';
import b2bRoutes from './b2b.routes';
import dashboardRoutes from './dashboard.routes';
import ordersRoutes from './orders.routes';
import stockRoutes from './stock.routes';
import invoicesRoutes from './invoices.routes';
import clientsRoutes from './clients.routes';
import suppliersRoutes from './suppliers.routes';
import alertsRoutes from './alerts.routes';
import automationsRoutes from './automations.routes';
import shopifyOauthRoutes from './shopify-oauth.routes';
import productionRoutes from './production.routes';
import componentsRoutes from './components.routes';
import marketingRoutes from './marketing.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/settings', settingsRoutes);
router.use('/b2b', b2bRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/orders', ordersRoutes);
router.use('/stock', stockRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/clients', clientsRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/alerts', alertsRoutes);
router.use('/automations', automationsRoutes);
router.use('/shopify', shopifyOauthRoutes);
router.use('/production', productionRoutes);
router.use('/components', componentsRoutes);
router.use('/marketing', marketingRoutes);

export default router;
