import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import logger from '../lib/logger';
import axios from 'axios';

const B2B_JWT_SECRET = process.env.B2B_JWT_SECRET || process.env.JWT_SECRET || 'b2b_fallback';

// ─── Auth ────────────────────────────────────────────────────────

export const b2bLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const client = await prisma.b2BClient.findUnique({ where: { email } });
    if (!client || !client.active) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    if (!client.approved) {
      res.status(403).json({ error: 'Compte en attente de validation' });
      return;
    }
    const valid = await bcrypt.compare(password, client.password);
    if (!valid) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    const token = jwt.sign(
      { id: client.id, email: client.email, company: client.company, type: 'b2b' },
      B2B_JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, client: { id: client.id, email: client.email, name: client.name, company: client.company, discount: client.discount } });
  } catch (err) {
    logger.error('b2bLogin error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const b2bRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, company, phone } = req.body;
    if (!email || !password || !name || !company) {
      res.status(400).json({ error: 'Tous les champs sont requis' });
      return;
    }
    const existing = await prisma.b2BClient.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email déjà utilisé' });
      return;
    }
    const hashed = await bcrypt.hash(password, 12);
    const client = await prisma.b2BClient.create({
      data: { email, password: hashed, name, company, phone, approved: false, active: true },
      select: { id: true, email: true, name: true, company: true },
    });
    res.status(201).json({ message: 'Demande envoyée, en attente de validation', client });
  } catch (err) {
    logger.error('b2bRegister error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const b2bMe = async (req: B2BRequest, res: Response): Promise<void> => {
  try {
    const client = await prisma.b2BClient.findUnique({
      where: { id: req.b2bClient!.id },
      select: { id: true, email: true, name: true, company: true, discount: true, phone: true, address: true },
    });
    if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ─── Auth middleware ─────────────────────────────────────────────

export interface B2BRequest extends Request {
  b2bClient?: { id: string; email: string; company: string };
}

export const authenticateB2B = (req: B2BRequest, res: Response, next: () => void): void => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Non authentifié' }); return; }
  try {
    const decoded = jwt.verify(auth.substring(7), B2B_JWT_SECRET) as { id: string; email: string; company: string; type: string };
    if (decoded.type !== 'b2b') { res.status(401).json({ error: 'Token invalide' }); return; }
    req.b2bClient = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

// ─── Products ────────────────────────────────────────────────────

export const b2bGetProducts = async (req: B2BRequest, res: Response): Promise<void> => {
  try {
    const client = await prisma.b2BClient.findUnique({ where: { id: req.b2bClient!.id } });
    const products = await prisma.b2BProduct.findMany({
      where: { active: true },
      orderBy: { title: 'asc' },
    });
    // Apply client discount to each product
    const withPrices = products.map((p) => ({
      ...p,
      finalPrice: +(p.b2bPrice * (1 - (client?.discount || 0) / 100)).toFixed(2),
      clientDiscount: client?.discount || 0,
    }));
    res.json(withPrices);
  } catch (err) {
    logger.error('b2bGetProducts error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ─── Orders ──────────────────────────────────────────────────────

export const b2bGetOrders = async (req: B2BRequest, res: Response): Promise<void> => {
  try {
    const orders = await prisma.b2BOrder.findMany({
      where: { clientId: req.b2bClient!.id },
      include: { items: { include: { product: { select: { title: true, sku: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const b2bCreateOrder = async (req: B2BRequest, res: Response): Promise<void> => {
  try {
    const { items, notes, shippingAddress } = req.body as {
      items: Array<{ productId: string; quantity: number; config?: object }>;
      notes?: string;
      shippingAddress?: string;
    };

    if (!items?.length) { res.status(400).json({ error: 'Panier vide' }); return; }

    const client = await prisma.b2BClient.findUnique({ where: { id: req.b2bClient!.id } });
    if (!client) { res.status(404).json({ error: 'Client introuvable' }); return; }

    // Load products and compute prices
    const productIds = items.map((i) => i.productId);
    const products = await prisma.b2BProduct.findMany({ where: { id: { in: productIds } } });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    let totalAmount = 0;
    const orderItems = items.map((item) => {
      const product = productMap[item.productId];
      if (!product) throw new Error(`Produit ${item.productId} introuvable`);
      const unitPrice = +(product.b2bPrice * (1 - client.discount / 100)).toFixed(2);
      totalAmount += unitPrice * item.quantity;
      return { productId: item.productId, quantity: item.quantity, unitPrice, config: item.config };
    });

    // Create order in DB
    const order = await prisma.b2BOrder.create({
      data: {
        clientId: client.id,
        totalAmount,
        discount: client.discount,
        notes,
        shippingAddress,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } } },
    });

    // Create Shopify Draft Order
    try {
      const shopifyDraft = await createShopifyDraftOrder(order, client, productMap);
      if (shopifyDraft?.draft_order) {
        await prisma.b2BOrder.update({
          where: { id: order.id },
          data: {
            shopifyOrderId: String(shopifyDraft.draft_order.id),
            shopifyOrderNumber: shopifyDraft.draft_order.name,
          },
        });
      }
    } catch (shopifyErr) {
      logger.error('Failed to create Shopify draft order:', shopifyErr);
      // Don't fail the whole request - order is saved in DB
    }

    res.status(201).json(order);
  } catch (err) {
    logger.error('b2bCreateOrder error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la commande' });
  }
};

async function createShopifyDraftOrder(order: { id: string; items: Array<{ product: { shopifyVariantId: string | null; title: string; b2bPrice: number }; quantity: number; unitPrice: number; config: unknown }> }, client: { shopifyCustomerId: string | null; name: string; email: string; company: string; discount: number }, productMap: Record<string, { shopifyVariantId: string | null; title: string }>) {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token) return null;

  const lineItems = order.items.map((item) => {
    const base: Record<string, unknown> = {
      quantity: item.quantity,
      price: String(item.unitPrice),
      properties: item.config ? Object.entries(item.config as Record<string, string>).map(([name, value]) => ({ name, value })) : [],
    };
    if (item.product.shopifyVariantId) {
      base.variant_id = parseInt(item.product.shopifyVariantId);
    } else {
      // B2B exclusive product — custom line item
      base.title = item.product.title;
      base.requires_shipping = true;
    }
    return base;
  });

  const body: Record<string, unknown> = {
    draft_order: {
      line_items: lineItems,
      note: `Commande B2B — ${client.company} — Remise ${client.discount}%`,
      tags: 'B2B',
      note_attributes: [
        { name: 'b2b_order_id', value: order.id },
        { name: 'client_company', value: client.company },
        { name: 'client_discount', value: String(client.discount) },
      ],
    },
  };

  if (client.shopifyCustomerId) {
    (body.draft_order as Record<string, unknown>).customer = { id: parseInt(client.shopifyCustomerId) };
  }

  const response = await axios.post(
    `https://${shop}/admin/api/2024-01/draft_orders.json`,
    body,
    { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } }
  );
  return response.data;
}

// ─── Admin (ERP) ─────────────────────────────────────────────────

export const adminListB2BClients = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clients = await prisma.b2BClient.findMany({
      select: { id: true, email: true, name: true, company: true, discount: true, approved: true, active: true, phone: true, notes: true, createdAt: true, _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const adminCreateB2BClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, company, phone, discount, notes } = req.body;
    if (!email || !password || !name || !company) {
      res.status(400).json({ error: 'email, password, name, company requis' });
      return;
    }
    const existing = await prisma.b2BClient.findUnique({ where: { email } });
    if (existing) { res.status(409).json({ error: 'Email déjà utilisé' }); return; }
    const hashed = await bcrypt.hash(password, 12);
    const discountValue = discount || 0;

    // Create Shopify customer with B2B tags
    let shopifyCustomerId: string | undefined;
    try {
      const shopifyCustomer = await syncShopifyCustomer({ email, name, company, phone, discount: discountValue });
      if (shopifyCustomer?.customer?.id) {
        shopifyCustomerId = String(shopifyCustomer.customer.id);
      }
    } catch (shopifyErr) {
      logger.error('Failed to create Shopify customer:', shopifyErr);
    }

    const client = await prisma.b2BClient.create({
      data: { email, password: hashed, name, company, phone, discount: discountValue, notes, approved: true, active: true, shopifyCustomerId },
      select: { id: true, email: true, name: true, company: true, discount: true, approved: true, active: true, shopifyCustomerId: true },
    });
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const adminUpdateB2BClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, company, phone, discount, approved, active, notes, password } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (company !== undefined) data.company = company;
    if (phone !== undefined) data.phone = phone;
    if (discount !== undefined) data.discount = discount;
    if (approved !== undefined) data.approved = approved;
    if (active !== undefined) data.active = active;
    if (notes !== undefined) data.notes = notes;
    if (password) data.password = await bcrypt.hash(password, 12);

    // Sync Shopify customer tags if discount or active status changed
    if (discount !== undefined || active !== undefined || approved !== undefined) {
      try {
        const existing = await prisma.b2BClient.findUnique({ where: { id } });
        if (existing) {
          const updatedDiscount = discount !== undefined ? discount : existing.discount;
          const updatedActive = active !== undefined ? active : existing.active;
          const updatedApproved = approved !== undefined ? approved : existing.approved;
          if (existing.shopifyCustomerId) {
            await updateShopifyCustomerTags(existing.shopifyCustomerId, updatedDiscount, updatedActive && updatedApproved);
          } else if (updatedActive && updatedApproved) {
            const shopifyCustomer = await syncShopifyCustomer({
              email: existing.email, name: existing.name,
              company: existing.company, phone: existing.phone || undefined,
              discount: updatedDiscount,
            });
            if (shopifyCustomer?.customer?.id) {
              data.shopifyCustomerId = String(shopifyCustomer.customer.id);
            }
          }
        }
      } catch (shopifyErr) {
        logger.error('Failed to sync Shopify customer on update:', shopifyErr);
      }
    }

    const client = await prisma.b2BClient.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, company: true, discount: true, approved: true, active: true, shopifyCustomerId: true },
    });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const adminDeleteB2BClient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.b2BClient.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ─── B2B Products Admin ──────────────────────────────────────────

export const adminListB2BProducts = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await prisma.b2BProduct.findMany({ orderBy: { title: 'asc' } });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const adminCreateB2BProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shopifyProductId, shopifyVariantId, title, sku, description, b2bPrice, b2bOnly, imageUrl, options } = req.body;
    const product = await prisma.b2BProduct.create({
      data: { shopifyProductId, shopifyVariantId, title, sku, description, b2bPrice, b2bOnly: b2bOnly || false, imageUrl, options },
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const adminUpdateB2BProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, sku, description, b2bPrice, b2bOnly, active, imageUrl, options, shopifyProductId, shopifyVariantId } = req.body;
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (sku !== undefined) data.sku = sku;
    if (description !== undefined) data.description = description;
    if (b2bPrice !== undefined) data.b2bPrice = b2bPrice;
    if (b2bOnly !== undefined) data.b2bOnly = b2bOnly;
    if (active !== undefined) data.active = active;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (options !== undefined) data.options = options;
    if (shopifyProductId !== undefined) data.shopifyProductId = shopifyProductId;
    if (shopifyVariantId !== undefined) data.shopifyVariantId = shopifyVariantId;
    const product = await prisma.b2BProduct.update({ where: { id }, data });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const adminDeleteB2BProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.b2BProduct.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ─── Shopify customer sync helpers ───────────────────────────────

function b2bTags(discount: number, active = true): string {
  const tags = ['b2b'];
  if (active && discount > 0) tags.push(`b2b-${discount}`);
  return tags.join(', ');
}

async function syncShopifyCustomer(data: { email: string; name: string; company: string; phone?: string; discount: number }) {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token) return null;

  const [firstName, ...rest] = data.name.split(' ');
  const lastName = rest.join(' ') || data.company;

  // Check if customer already exists
  const searchRes = await axios.get(
    `https://${shop}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(data.email)}`,
    { headers: { 'X-Shopify-Access-Token': token } }
  );
  const existing = searchRes.data.customers?.[0];

  if (existing) {
    const updateRes = await axios.put(
      `https://${shop}/admin/api/2024-01/customers/${existing.id}.json`,
      { customer: { id: existing.id, tags: b2bTags(data.discount), note: `B2B client — ${data.company}` } },
      { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } }
    );
    return updateRes.data;
  }

  const createRes = await axios.post(
    `https://${shop}/admin/api/2024-01/customers.json`,
    {
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        tags: b2bTags(data.discount),
        note: `B2B client — ${data.company}`,
        verified_email: true,
        send_email_welcome: false,
      },
    },
    { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } }
  );

  // Send Shopify account invite so client can set their password and log in
  const newCustomerId = createRes.data?.customer?.id;
  if (newCustomerId) {
    await sendShopifyAccountInvite(shop, token, newCustomerId).catch((e) =>
      logger.warn('Shopify invite email failed:', e?.message)
    );
  }

  return createRes.data;
}

async function sendShopifyAccountInvite(shop: string, token: string, customerId: string | number) {
  await axios.post(
    `https://${shop}/admin/api/2024-01/customers/${customerId}/send_invite.json`,
    {},
    { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } }
  );
}

async function updateShopifyCustomerTags(shopifyCustomerId: string, discount: number, active: boolean) {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!shop || !token) return;
  await axios.put(
    `https://${shop}/admin/api/2024-01/customers/${shopifyCustomerId}.json`,
    { customer: { id: shopifyCustomerId, tags: b2bTags(discount, active) } },
    { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } }
  );
}

export const adminListB2BOrders = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await prisma.b2BOrder.findMany({
      include: { client: { select: { company: true, name: true } }, items: { include: { product: { select: { title: true, sku: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
