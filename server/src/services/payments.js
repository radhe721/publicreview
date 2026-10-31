import crypto from 'crypto';
import { env } from '../config/env.js';

// Prices in US cents.
export const PRODUCTS = {
  report: { name: 'Validation Report', amount: 2900, mode: 'payment' },
  featured: { name: 'Featured spot (24 hours)', amount: 1500, mode: 'payment' },
  pro: { name: 'BusinessListe Pro (1 month)', amount: 1900, mode: 'payment' }
};

export function paymentsEnabled() {
  return Boolean(env.STRIPE_SECRET_KEY);
}

// Creates a Stripe Checkout session through the REST API (no SDK needed).
export async function createCheckoutSession({ product, purchaseId, email, successPath, cancelPath }) {
  const p = PRODUCTS[product];
  const form = new URLSearchParams({
    mode: p.mode,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(p.amount),
    'line_items[0][price_data][product_data][name]': p.name,
    client_reference_id: String(purchaseId),
    'metadata[purchase_id]': String(purchaseId),
    success_url: `${env.CLIENT_URL}${successPath}`,
    cancel_url: `${env.CLIENT_URL}${cancelPath}`
  });
  if (email) form.set('customer_email', email);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || 'Stripe checkout failed');
  return { id: body.id, url: body.url };
}

// Verifies the Stripe-Signature header (v1 HMAC-SHA256, 5 minute tolerance).
export function verifyStripeSignature(rawBody, header, secret = env.STRIPE_WEBHOOK_SECRET, now = Date.now()) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((kv) => kv.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const signatures = String(header).split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(now / 1000 - timestamp) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return signatures.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

// Monthly recurring revenue from a Stripe restricted (read-only) key. The key is used once and never stored.
export async function fetchStripeMrrCents(restrictedKey) {
  let total = 0;
  let startingAfter = null;
  for (let page = 0; page < 20; page++) {
    const url = new URL('https://api.stripe.com/v1/subscriptions');
    url.searchParams.set('status', 'active');
    url.searchParams.set('limit', '100');
    if (startingAfter) url.searchParams.set('starting_after', startingAfter);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${restrictedKey}` }, signal: AbortSignal.timeout(10000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error?.message || 'Stripe rejected the key');
    for (const sub of body.data || []) {
      for (const item of sub.items?.data || []) {
        const price = item.price || item.plan || {};
        const unit = Number(price.unit_amount ?? price.amount ?? 0);
        const qty = Number(item.quantity || 1);
        const interval = price.recurring?.interval || price.interval || 'month';
        const count = Number(price.recurring?.interval_count || price.interval_count || 1);
        const perMonth = { day: 30, week: 52 / 12, month: 1, year: 1 / 12 }[interval] ?? 1;
        total += (unit * qty * perMonth) / count;
      }
    }
    if (!body.has_more || !body.data?.length) break;
    startingAfter = body.data[body.data.length - 1].id;
  }
  return Math.round(total);
}
