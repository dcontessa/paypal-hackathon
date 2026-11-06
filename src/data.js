// Seed data: a fictional micro-merchant with a cash-flow squeeze.
// All names are fictional. Dates are relative to "today" so the demo never goes stale.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './env.js';

const DAY = 86400000;
export const isoDay = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

export const merchant = {
  name: "Lina's Batik Studio",
  tagline: 'Hand-printed textiles, Petaling Jaya',
  startingBalance: 350,
};

// dueOffset: days from today (negative = overdue). lates: count of past late payments by this client.
const seed = [
  { id: 'INV-101', client: 'Bayu Interiors', amount: 1800, dueOffset: -33, lates: 4 },
  { id: 'INV-102', client: 'Harbour Café', amount: 640, dueOffset: -21, lates: 3 },
  { id: 'INV-103', client: 'Orchid Events', amount: 1250, dueOffset: -9, lates: 1 },
  { id: 'INV-104', client: 'Studio Meridian', amount: 480, dueOffset: -4, lates: 0 },
  { id: 'INV-105', client: 'Taman Kids Club', amount: 900, dueOffset: 3, lates: 0 },
  { id: 'INV-106', client: 'Cendana Hotel', amount: 2200, dueOffset: 10, lates: 1 },
];

export const bills = [
  { name: 'Studio rent', amount: 1200, dayOffset: 5 },
  { name: 'Fabric supplier', amount: 1400, dayOffset: 12 },
  { name: 'Part-time payroll', amount: 1500, dayOffset: 20 },
];

// Optional mapping of local invoice ids to real PayPal sandbox invoice ids (written by `npm run seed`).
let sandboxIds = {};
const mapFile = join(ROOT, 'data', 'sandbox-invoices.json');
if (existsSync(mapFile)) {
  try {
    sandboxIds = JSON.parse(readFileSync(mapFile, 'utf8'));
  } catch {
    sandboxIds = {};
  }
}

export const invoices = seed.map((s) => ({
  ...s,
  due: isoDay(s.dueOffset),
  status: 'OPEN',
  reminded: false,
  paypalId: sandboxIds[s.id] || null,
}));

// Live, mutable app state.
export const state = {
  proposals: [],
  log: [],
};

export function audit(kind, text, meta = {}) {
  state.log.unshift({ at: new Date().toISOString(), kind, text, ...meta });
  if (state.log.length > 200) state.log.pop();
}
