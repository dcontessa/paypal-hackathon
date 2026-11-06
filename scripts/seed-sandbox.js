// Creates and sends the seed invoices in your PayPal SANDBOX and records their ids in
// data/sandbox-invoices.json so Runway can remind and track the real invoices.
import '../src/env.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../src/env.js';
import { invoices, merchant, isoDay } from '../src/data.js';
import { createAndSendInvoice, paypalConfigured } from '../src/paypal.js';

if (!paypalConfigured()) {
  console.error('Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox) in .env first.');
  process.exit(1);
}

const map = {};
for (const inv of invoices) {
  try {
    // PayPal may reject past due dates, so sandbox invoices are due today; overdue-ness is modelled locally.
    map[inv.id] = await createAndSendInvoice({
      number: `${inv.id}-${Date.now() % 100000}`,
      client: inv.client,
      amount: inv.amount,
      dueDate: isoDay(0),
      merchantName: merchant.name,
    });
    console.log(`created ${inv.id} -> ${map[inv.id]}`);
  } catch (err) {
    console.error(`failed ${inv.id}: ${err.message}`);
  }
}
mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(join(ROOT, 'data', 'sandbox-invoices.json'), JSON.stringify(map, null, 2));
console.log('Saved data/sandbox-invoices.json');
