// PayPal REST API v2 client — OAuth, Orders, Authorizations
import 'dotenv/config';

const BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

/** OAuth2: POST /v1/oauth2/token — returns bearer token (cached ~9h) */
export async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('PayPal credentials missing. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env');
  }
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PayPal OAuth failed: ${res.status} ${txt}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function paypalFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`PayPal ${method} ${path} → ${res.status}: ${text}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/** Create escrow order with intent=AUTHORIZE */
export async function createEscrowOrder({ milestoneId, description, amount, currency = 'USD', returnUrl, cancelUrl }) {
  return paypalFetch('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'AUTHORIZE',
      purchase_units: [
        {
          reference_id: milestoneId,
          description: description.slice(0, 127),
          amount: { currency_code: currency, value: Number(amount).toFixed(2) },
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: 'CONTINUE',
        brand_name: 'ProofLedger',
        shipping_preference: 'NO_SHIPPING',
      },
    },
  });
}

/** After buyer approves, authorize the order (places hold) */
export async function authorizeOrder(orderId) {
  return paypalFetch(`/v2/checkout/orders/${orderId}/authorize`, { method: 'POST', body: {} });
}

/** Capture the authorized funds (release to merchant) */
export async function captureAuthorization(authorizationId, { amount, currency = 'USD', note = '' }) {
  return paypalFetch(`/v2/payments/authorizations/${authorizationId}/capture`, {
    method: 'POST',
    body: {
      amount: { currency_code: currency, value: Number(amount).toFixed(2) },
      final_capture: true,
      note_to_payer: note.slice(0, 254),
    },
  });
}

/** Void the authorization (release hold back to buyer) */
export async function voidAuthorization(authorizationId) {
  return paypalFetch(`/v2/payments/authorizations/${authorizationId}/void`, { method: 'POST' });
}

/** Inspect an order (for debugging + status checks) */
export async function getOrder(orderId) {
  return paypalFetch(`/v2/checkout/orders/${orderId}`);
}

/** Extract approval URL from order creation response */
export function approvalLink(order) {
  return order?.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action')?.href;
}
