import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';

const router = Router();

const SCOPES = 'read_orders,write_orders,read_products,write_products,read_inventory,write_inventory,read_customers,write_customers,read_fulfillments,write_fulfillments';

// Step 1: Redirect to Shopify OAuth
router.get('/install', (_req: Request, res: Response) => {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN!;
  const apiKey = process.env.SHOPIFY_API_KEY!;
  const redirectUri = `http://${process.env.VPS_IP || '187.124.53.40'}/api/shopify/callback`;
  const nonce = crypto.randomBytes(16).toString('hex');

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;
  res.redirect(authUrl);
});

// Step 2: Handle OAuth callback and exchange code for token
router.get('/callback', async (req: Request, res: Response) => {
  const { code, shop } = req.query;

  if (!code || !shop) {
    res.status(400).send('Missing code or shop');
    return;
  }

  try {
    const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    });

    const accessToken = response.data.access_token;

    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;background:#1a1a2e;color:white">
        <h2>✅ Shopify connecté avec succès !</h2>
        <p>Copie ce token et ajoute-le dans ton <code>.env</code> :</p>
        <code style="background:#0f3460;padding:16px;display:block;border-radius:8px;font-size:14px;word-break:break-all">
          SHOPIFY_ACCESS_TOKEN=${accessToken}
        </code>
        <p style="margin-top:20px">Puis relance le backend : <code>pm2 restart runner-erp</code></p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`Erreur OAuth : ${err}`);
  }
});

export default router;
