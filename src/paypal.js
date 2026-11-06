// Thin PayPal Invoicing client (SANDBOX ONLY). Falls back to mock mode without credentials.
// NOTE: endpoints follow the public PayPal Invoicing v2 API; verify against current docs if a call fails.
import { CURRENCY } from './env.js';

const BASE = 'https://api-m.sandbox.paypal.com';
let cached = { token: null, exp: 0 };

export const paypalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

async function token() {
  if (cached.token && Date.now() < cached.exp) return cached.token;
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const json = await res.json();
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in - 60) * 1000 };
  return cached.token;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {};
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`PayPal ${method} ${path} -> ${res.status} ${json.message || text.slice(0, 200)}`);
  return json;
}

export async function createAndSendInvoice({ number, client, amount, dueDate, merchantName }) {
  const email = process.env.DEMO_BUYER_EMAIL;
  if (!email) throw new Error('DEMO_BUYER_EMAIL is required to create sandbox invoices');
  const draft = await api('/v2/invoicing/invoices', {
    method: 'POST',
    body: {
      detail: {
        invoice_number: number,
        currency_code: CURRENCY,
        note: `${merchantName}: invoice for ${client}`,
        payment_term: { term_type: 'DUE_ON_DATE_SPECIFIED', due_date: dueDate },
      },
      primary_recipients: [{ billing_info: { business_name: client, email_address: email } }],
      items: [
        {
          name: 'Batik textile order',
          quantity: '1',
          unit_amount: { currency_code: CURRENCY, value: amount.toFixed(2) },
        },
      ],
    },
  });
  const id = draft.href.split('/').pop();
  await api(`/v2/invoicing/invoices/${id}/send`, { method: 'POST', body: { send_to_recipient: true, send_to_invoicer: false } });
  return id;
}

export async function remindInvoice(id, { subject, note }) {
  await api(`/v2/invoicing/invoices/${id}/remind`, {
    method: 'POST',
    body: { subject, note, send_to_invoicer: false, send_to_recipient: true },
  });
  return { ok: true };
}

export async function invoiceStatus(id) {
  const inv = await api(`/v2/invoicing/invoices/${id}`);
  return inv.status; // e.g. SENT, PAID, PARTIALLY_PAID
}
