/**
 * One-time setup script: creates the Shopify PaymentCustomization object
 * that activates the b2b-payment-filter Shopify Function.
 *
 * Usage:
 *   node scripts/create-payment-customization.mjs <shop> <token>
 *
 * Example:
 *   node scripts/create-payment-customization.mjs runner-9633.myshopify.com shpat_xxxx
 *
 * The token must have the write_payment_customizations scope.
 * Get one from: Shopify Admin → Settings → Apps → Develop apps → Create app
 */

const FUNCTION_ID = 'e97fb07e9824130ae984302b9e70475e';

const [,, shop, token] = process.argv;

if (!shop || !token) {
  console.error('Usage: node scripts/create-payment-customization.mjs <shop> <token>');
  process.exit(1);
}

const mutation = `
  mutation CreatePaymentCustomization($input: PaymentCustomizationInput!) {
    paymentCustomizationCreate(paymentCustomization: $input) {
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

const variables = {
  input: {
    title: 'Hide 30-day payment for non-B2B',
    enabled: true,
    functionId: FUNCTION_ID,
  },
};

async function run() {
  const url = `https://${shop}/admin/api/2024-10/graphql.json`;

  console.log(`Calling ${url} ...`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('HTTP error:', res.status, data);
    process.exit(1);
  }

  const result = data?.data?.paymentCustomizationCreate;

  if (result?.userErrors?.length) {
    console.error('User errors:', JSON.stringify(result.userErrors, null, 2));
    process.exit(1);
  }

  console.log('✓ PaymentCustomization created:', JSON.stringify(result?.paymentCustomization, null, 2));
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
