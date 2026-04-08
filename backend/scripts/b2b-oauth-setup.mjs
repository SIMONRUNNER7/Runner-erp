/**
 * OAuth flow to get a Shopify access token and create the PaymentCustomization.
 * Run from the runner-b2b-payments project directory after:
 *   1. Adding write_payment_customizations scope in shopify.app.toml
 *   2. Running: shopify app deploy
 *
 * Usage: node b2b-oauth-setup.mjs
 */

import http from 'http';
import { exec } from 'child_process';
import crypto from 'crypto';

const CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID     || 'e97fb07e9824130ae984302b9e70475e';
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || (() => { throw new Error('Set SHOPIFY_CLIENT_SECRET env var'); })();
const SHOP          = process.env.SHOPIFY_SHOP          || 'runner-9633.myshopify.com';
const FUNCTION_ID   = 'e97fb07e9824130ae984302b9e70475e';
const REDIRECT_URI  = 'http://localhost:3000/callback';
const SCOPE         = 'write_payment_customizations';

const state = crypto.randomBytes(16).toString('hex');
const authUrl = `https://${SHOP}/admin/oauth/authorize?client_id=${CLIENT_ID}&scope=${SCOPE}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&grant_options[]=per-user`;

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) {
    res.writeHead(200);
    res.end('En attente du callback OAuth...');
    return;
  }

  const url = new URL(req.url, 'http://localhost:3000');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('Pas de code reçu.');
    server.close();
    return;
  }

  console.log('Code reçu, échange contre un token...');

  // Exchange code for permanent access token
  const tokenRes = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
  });

  const tokenData = await tokenRes.json();
  console.log('Token data:', tokenData);

  const access_token = tokenData.access_token;
  if (!access_token) {
    res.writeHead(500);
    res.end('Échec échange token: ' + JSON.stringify(tokenData));
    server.close();
    return;
  }

  console.log('Token obtenu. Création du PaymentCustomization...');

  // Create PaymentCustomization
  const mutation = `
    mutation {
      paymentCustomizationCreate(paymentCustomization: {
        title: "Hide 30-day payment for non-B2B"
        enabled: true
        functionId: "${FUNCTION_ID}"
      }) {
        paymentCustomization {
          id
          title
          enabled
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const gqlRes = await fetch(`https://${SHOP}/admin/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': access_token,
    },
    body: JSON.stringify({ query: mutation }),
  });

  const data = await gqlRes.json();
  const result = data?.data?.paymentCustomizationCreate;

  if (result?.userErrors?.length) {
    const msg = 'Erreurs: ' + JSON.stringify(result.userErrors, null, 2);
    console.error(msg);
    res.writeHead(500);
    res.end(msg);
  } else {
    const msg = '✓ PaymentCustomization créé: ' + JSON.stringify(result?.paymentCustomization, null, 2);
    console.log(msg);
    res.writeHead(200);
    res.end(msg);
  }

  server.close();
  process.exit(0);
});

server.listen(3000, () => {
  console.log('\nServeur OAuth démarré sur http://localhost:3000');
  console.log('\nOuverture du navigateur...\n');
  console.log('URL OAuth:', authUrl, '\n');
  exec(`open "${authUrl}"`);
});
