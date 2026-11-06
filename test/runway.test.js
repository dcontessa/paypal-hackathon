import test from 'node:test';
import assert from 'node:assert/strict';
import { invoices } from '../src/data.js';
import { forecast, payProbability, riskLabel } from '../src/forecast.js';

test('longer-overdue, repeat-late invoices are riskier', () => {
  const worst = invoices.find((i) => i.id === 'INV-101');
  const best = invoices.find((i) => i.id === 'INV-104');
  assert.ok(payProbability(worst) < payProbability(best));
  assert.equal(riskLabel(worst), 'high');
});

test('not-yet-due invoices are labelled not due', () => {
  assert.equal(riskLabel(invoices.find((i) => i.id === 'INV-105')), 'not due');
});

test('successful reminders never worsen the cash low point', () => {
  const ids = new Set(invoices.filter((i) => i.dueOffset < 0).map((i) => i.id));
  const f = forecast(ids);
  assert.ok(f.withAgent.minBalance >= f.baseline.minBalance);
  assert.ok(f.recovered >= 0);
});

test('forecast covers 31 days (day 0..30)', () => {
  assert.equal(forecast().baseline.days.length, 31);
});
