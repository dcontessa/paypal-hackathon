import './env.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { merchant, invoices, bills, state, audit } from './data.js';
import { forecast, payProbability, riskLabel } from './forecast.js';
import { runAgent, llmConfigured } from './agent.js';
import { paypalConfigured, remindInvoice, invoiceStatus } from './paypal.js';

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(join(dirname(fileURLToPath(import.meta.url)), '..', 'public')));

const find = (list, id) => list.find((x) => x.id === id);
const mode = () => ({
  paypal: paypalConfigured() ? 'sandbox' : 'mock',
  agent: llmConfigured() ? 'claude' : 'offline',
});

// Pull real payment status for invoices that exist in the PayPal sandbox.
let lastSync = 0;
async function syncFromPaypal() {
  if (!paypalConfigured() || Date.now() - lastSync < 5000) return;
  lastSync = Date.now();
  for (const inv of invoices.filter((i) => i.paypalId && i.status === 'OPEN')) {
    try {
      if ((await invoiceStatus(inv.paypalId)) === 'PAID') markPaid(inv, 'PayPal');
    } catch (err) {
      audit('error', `Status check failed for ${inv.id}: ${err.message}`);
    }
  }
}

function markPaid(inv, via) {
  inv.status = 'PAID';
  audit('payment', `${inv.client} paid ${inv.id} (${inv.amount}) via ${via}`, { invoiceId: inv.id });
}

app.get('/api/state', async (_req, res) => {
  await syncFromPaypal();
  const reminded = new Set(state.proposals.filter((p) => p.status !== 'rejected').map((p) => p.invoiceId));
  res.json({
    mode: mode(),
    merchant,
    bills,
    invoices: invoices.map((i) => ({
      ...i,
      daysOverdue: Math.max(0, -i.dueOffset),
      payProbability: Number(payProbability(i).toFixed(2)),
      risk: riskLabel(i),
    })),
    forecast: forecast(reminded),
    proposals: state.proposals,
    log: state.log.slice(0, 30),
  });
});

app.post('/api/agent/run', async (_req, res) => {
  try {
    res.json({ trace: await runAgent() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/actions/:id/approve', async (req, res) => {
  const p = find(state.proposals, req.params.id);
  if (!p || p.status !== 'pending') return res.status(404).json({ error: 'No pending action with that id' });
  const inv = find(invoices, p.invoiceId);
  // The human may edit the message before approving.
  if (typeof req.body?.note === 'string' && req.body.note.trim()) p.note = req.body.note.trim().slice(0, 1000);
  try {
    if (paypalConfigured() && inv.paypalId) {
      await remindInvoice(inv.paypalId, { subject: p.subject, note: p.note });
      p.channel = 'PayPal sandbox';
    } else {
      p.channel = 'mock (no PayPal credentials or sandbox invoice)';
    }
    p.status = 'executed';
    inv.reminded = true;
    audit('human', `Approved ${p.id}: reminder sent for ${inv.id} via ${p.channel}`, { actionId: p.id });
    res.json(p);
  } catch (err) {
    audit('error', `Send failed for ${p.id}: ${err.message}`, { actionId: p.id });
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/actions/:id/reject', (req, res) => {
  const p = find(state.proposals, req.params.id);
  if (!p || p.status !== 'pending') return res.status(404).json({ error: 'No pending action with that id' });
  p.status = 'rejected';
  audit('human', `Rejected ${p.id} for ${p.invoiceId}`, { actionId: p.id });
  res.json(p);
});

// Demo helper: only available in mock mode, so it can never fake a real PayPal payment.
app.post('/api/invoices/:id/simulate-payment', (req, res) => {
  if (paypalConfigured()) return res.status(403).json({ error: 'Disabled when PayPal sandbox is configured; pay the invoice in the sandbox.' });
  const inv = find(invoices, req.params.id);
  if (!inv || inv.status !== 'OPEN') return res.status(404).json({ error: 'No open invoice with that id' });
  markPaid(inv, 'simulated payment');
  res.json(inv);
});

const port = Number(process.env.PORT) || 3000;
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(port, () => console.log(`Runway on http://localhost:${port}  [paypal=${mode().paypal}, agent=${mode().agent}]`));
}
export default app;
