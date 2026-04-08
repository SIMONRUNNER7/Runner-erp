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

// ── B2B Payment Setup ─────────────────────────────────────────────────────────
// One-time OAuth flow to create the PaymentCustomization object that activates
// the b2b-payment-filter Shopify Function.
//
// 1. Visit https://erp.runner.golf/api/shopify/b2b-payment-install
// 2. Authorize in Shopify
// 3. PaymentCustomization is created automatically
//
// Required env vars on VPS:
//   SHOPIFY_B2B_CLIENT_ID     = eb7609f57c4daf392771ba27d1592b48
//   SHOPIFY_B2B_CLIENT_SECRET = (from Partner Dashboard)
//   SHOPIFY_SHOP_DOMAIN       = runner-9633.myshopify.com

const B2B_REDIRECT_URI = 'https://erp.runner.golf/api/shopify/b2b-payment-callback';
const B2B_FUNCTION_ID  = 'e97fb07e9824130ae984302b9e70475e';

router.get('/b2b-payment-install', (_req: Request, res: Response) => {
  const shop     = process.env.SHOPIFY_SHOP_DOMAIN!;
  const clientId = process.env.SHOPIFY_B2B_CLIENT_ID!;

  if (!shop || !clientId) {
    res.status(500).send('SHOPIFY_SHOP_DOMAIN or SHOPIFY_B2B_CLIENT_ID env var missing');
    return;
  }

  const state   = crypto.randomBytes(16).toString('hex');
  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=write_payment_customizations&redirect_uri=${encodeURIComponent(B2B_REDIRECT_URI)}&state=${state}`;
  res.redirect(authUrl);
});

router.get('/b2b-payment-callback', async (req: Request, res: Response) => {
  const { code, shop } = req.query as { code?: string; shop?: string };

  if (!code || !shop) {
    res.status(400).send('Missing code or shop');
    return;
  }

  const clientId     = process.env.SHOPIFY_B2B_CLIENT_ID!;
  const clientSecret = process.env.SHOPIFY_B2B_CLIENT_SECRET!;

  if (!clientId || !clientSecret) {
    res.status(500).send('SHOPIFY_B2B_CLIENT_ID or SHOPIFY_B2B_CLIENT_SECRET env var missing');
    return;
  }

  try {
    // Exchange code for token
    const tokenRes = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });
    const accessToken: string = tokenRes.data.access_token;

    // Create PaymentCustomization
    const mutation = `
      mutation {
        paymentCustomizationCreate(paymentCustomization: {
          title: "Hide 30-day payment for non-B2B"
          enabled: true
          functionId: "${B2B_FUNCTION_ID}"
        }) {
          paymentCustomization { id title enabled }
          userErrors { field message }
        }
      }
    `;

    const gqlRes = await axios.post(
      `https://${shop}/admin/api/2024-10/graphql.json`,
      { query: mutation },
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } },
    );

    const result = gqlRes.data?.data?.paymentCustomizationCreate;
    const errors = result?.userErrors ?? [];

    if (errors.length > 0) {
      res.status(400).send(`
        <html><body style="font-family:sans-serif;padding:40px;background:#1a1a2e;color:#ff6b6b">
          <h2>❌ Erreurs</h2>
          <pre>${JSON.stringify(errors, null, 2)}</pre>
        </body></html>
      `);
      return;
    }

    const pc = result?.paymentCustomization;
    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;background:#1a1a2e;color:white">
        <h2>✅ PaymentCustomization créé !</h2>
        <p>La fonction B2B masquera désormais le paiement 30 jours pour les non-B2B.</p>
        <pre style="background:#0f3460;padding:16px;border-radius:8px">${JSON.stringify(pc, null, 2)}</pre>
      </body></html>
    `);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Erreur : ${msg}`);
  }
});

export default router;
