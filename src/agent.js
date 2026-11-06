// The Runway agent. Reads invoices + forecast, then PROPOSES reminders. It never moves money or
// contacts a client by itself: every proposal waits for human approval (see server.js).
import Anthropic from '@anthropic-ai/sdk';
import { invoices, merchant, state, audit } from './data.js';
import { forecast, payProbability, riskLabel } from './forecast.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
export const llmConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM = `You are Runway, a cash-flow copilot for ${merchant.name}, a micro-merchant.
Goal: protect the merchant's 30-day cash runway by recovering overdue invoices, kindly and without damaging client relationships.
Process: (1) call get_invoices, (2) call get_forecast, (3) for each overdue invoice worth chasing, call propose_reminder.
Rules: you can only PROPOSE; a human approves every message. Be warm, specific and brief. Never threaten. Match tone to history:
first-time or mildly late = friendly; repeatedly late = firm but respectful and offer instalments. Prioritise by amount and cash-gap impact.
Never invent facts about a client. Do not propose a reminder for an invoice that is not yet due. After proposing, give a 2-sentence summary.`;

const TOOLS = [
  {
    name: 'get_invoices',
    description: 'List open invoices with days overdue, payment history and estimated payment probability.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_forecast',
    description: 'Get the 30-day cash forecast: lowest balance, the day it occurs, and balance if reminders succeed.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'propose_reminder',
    description: 'Propose (not send) a payment reminder to a client. A human must approve it.',
    input_schema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string' },
        tone: { type: 'string', enum: ['friendly', 'firm-warm'] },
        subject: { type: 'string', description: 'Short email subject.' },
        message: { type: 'string', description: 'Body, under 70 words, no threats.' },
        offer_instalments: { type: 'boolean' },
        rationale: { type: 'string', description: 'One sentence: why chase this one, and why this tone.' },
      },
      required: ['invoice_id', 'tone', 'subject', 'message', 'rationale'],
    },
  },
];

const openInvoices = () => invoices.filter((i) => i.status === 'OPEN');

function invoiceView(i) {
  return {
    id: i.id,
    client: i.client,
    amount: i.amount,
    days_overdue: Math.max(0, -i.dueOffset),
    previous_late_payments: i.lates,
    pay_probability: Number(payProbability(i).toFixed(2)),
    risk: riskLabel(i),
  };
}

function pendingIds() {
  return new Set(state.proposals.filter((p) => p.status === 'pending' || p.status === 'executed').map((p) => p.invoiceId));
}

function addProposal(args, trace) {
  const inv = invoices.find((i) => i.id === args.invoice_id);
  if (!inv) return { error: `Unknown invoice ${args.invoice_id}` };
  if (inv.dueOffset >= 0) return { error: 'Invoice is not overdue yet; no reminder proposed.' };
  if (pendingIds().has(inv.id)) return { error: 'A reminder is already pending or sent for this invoice.' };
  const p = {
    id: `ACT-${state.proposals.length + 1}`,
    invoiceId: inv.id,
    client: inv.client,
    amount: inv.amount,
    tone: args.tone,
    subject: String(args.subject).slice(0, 120),
    note: String(args.message).slice(0, 1000),
    offerInstalments: Boolean(args.offer_instalments),
    rationale: String(args.rationale).slice(0, 300),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  state.proposals.push(p);
  trace.push({ type: 'proposal', text: `Proposed ${p.tone} reminder to ${p.client} (${p.amount})` });
  audit('agent', `Proposed ${p.tone} reminder for ${p.invoiceId} (${p.client})`, { actionId: p.id });
  return { ok: true, action_id: p.id };
}

function runTool(name, input, trace) {
  if (name === 'get_invoices') {
    trace.push({ type: 'tool', text: 'Reading open invoices from PayPal-backed ledger' });
    return openInvoices().map(invoiceView);
  }
  if (name === 'get_forecast') {
    const f = forecast(pendingIds());
    trace.push({
      type: 'tool',
      text: `Forecast: lowest balance ${f.baseline.minBalance} on day ${f.baseline.minDay}; ${f.withAgent.minBalance} if reminders land`,
    });
    return {
      lowest_balance_without_action: f.baseline.minBalance,
      lowest_day: f.baseline.minDay,
      lowest_balance_if_reminders_succeed: f.withAgent.minBalance,
    };
  }
  if (name === 'propose_reminder') return addProposal(input, trace);
  return { error: `Unknown tool ${name}` };
}

// Deterministic planner used when no ANTHROPIC_API_KEY is set (or the API call fails).
function offlinePlan(trace) {
  trace.push({ type: 'thought', text: 'Offline planner: ranking overdue invoices by amount and lateness.' });
  const targets = openInvoices()
    .filter((i) => i.dueOffset < 0 && !pendingIds().has(i.id))
    .sort((a, b) => b.amount * Math.min(1, -b.dueOffset / 14) - a.amount * Math.min(1, -a.dueOffset / 14));
  const f = forecast(pendingIds());
  trace.push({
    type: 'tool',
    text: `Forecast: lowest balance ${f.baseline.minBalance} on day ${f.baseline.minDay}; ${f.withAgent.minBalance} if reminders land`,
  });
  for (const i of targets) {
    const firm = i.lates >= 3;
    addProposal(
      {
        invoice_id: i.id,
        tone: firm ? 'firm-warm' : 'friendly',
        subject: `A gentle reminder: invoice ${i.id}`,
        message: firm
          ? `Hi ${i.client} team, invoice ${i.id} for ${i.amount} is now ${-i.dueOffset} days past due. We value working with you and would like to get this settled. If a lump sum is difficult, we are happy to arrange instalments. Thank you.`
          : `Hi ${i.client} team, a quick note that invoice ${i.id} for ${i.amount} was due ${-i.dueOffset} days ago. If it has already been paid, please ignore this. Otherwise you can pay securely in one click via PayPal. Thank you!`,
        offer_instalments: firm,
        rationale: `${i.client} is ${-i.dueOffset} days late on ${i.amount} with ${i.lates} earlier late payment(s), so a ${firm ? 'firm but warm' : 'friendly'} tone fits.`,
      },
      trace,
    );
  }
  trace.push({ type: 'thought', text: `Done. ${targets.length} reminder(s) are waiting for your approval.` });
}

export async function runAgent() {
  const trace = [];
  audit('agent', 'Agent run started');
  if (!llmConfigured()) {
    trace.push({ type: 'thought', text: 'No ANTHROPIC_API_KEY set: running in offline demo mode.' });
    offlinePlan(trace);
    return trace;
  }
  try {
    const client = new Anthropic();
    const messages = [{ role: 'user', content: 'Review my receivables and propose the reminders that protect my cash runway.' }];
    for (let step = 0; step < 8; step++) {
      const res = await client.messages.create({ model: MODEL, max_tokens: 2000, system: SYSTEM, tools: TOOLS, messages });
      messages.push({ role: 'assistant', content: res.content });
      for (const b of res.content) if (b.type === 'text' && b.text.trim()) trace.push({ type: 'thought', text: b.text.trim() });
      if (res.stop_reason !== 'tool_use') return trace;
      const results = res.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(runTool(b.name, b.input, trace)) }));
      messages.push({ role: 'user', content: results });
    }
    trace.push({ type: 'thought', text: 'Stopped after the step limit.' });
  } catch (err) {
    trace.push({ type: 'thought', text: `LLM unavailable (${err.message}). Falling back to offline planner.` });
    audit('agent', `LLM error, using offline planner: ${err.message}`);
    offlinePlan(trace);
  }
  return trace;
}
