// 30-day cash-flow forecast. Two scenarios:
//   baseline  : clients pay on their historical pattern
//   withAgent : invoices that have a reminder queued/sent are likely to be paid within days
import { merchant, bills, invoices } from './data.js';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function payProbability(inv) {
  const overdue = Math.max(0, -inv.dueOffset);
  return clamp(0.95 - 0.015 * overdue - 0.08 * inv.lates, 0.15, 0.95);
}

export function riskLabel(inv) {
  const p = payProbability(inv);
  if (inv.dueOffset >= 0) return 'not due';
  return p < 0.45 ? 'high' : p < 0.7 ? 'medium' : 'low';
}

// Day an unreminded invoice is expected to land.
function baselineDay(inv) {
  if (inv.dueOffset >= 0) return inv.dueOffset + 3 + inv.lates * 3; // clients tend to pay a few days after due
  return 8 + inv.lates * 6; // overdue: slow trickle based on history
}

export function forecast(remindedIds = new Set(), horizon = 30) {
  const open = invoices.filter((i) => i.status === 'OPEN');
  const run = (agent) => {
    const flows = new Array(horizon + 1).fill(0);
    for (const b of bills) if (b.dayOffset <= horizon) flows[b.dayOffset] -= b.amount;
    for (const inv of open) {
      const boosted = agent && remindedIds.has(inv.id);
      // A reminder raises pay probability by 0.35 (capped at 0.9) and pulls payment forward. Worse payers stay slower.
      const p = boosted ? Math.min(0.9, payProbability(inv) + 0.35) : payProbability(inv);
      const day = clamp(boosted ? Math.min(baselineDay(inv), 2 + inv.lates) : baselineDay(inv), 0, horizon);
      flows[day] += inv.amount * p;
    }
    let balance = merchant.startingBalance;
    const days = flows.map((f, d) => {
      balance += f;
      return { day: d, balance: Math.round(balance) };
    });
    const min = days.reduce((a, b) => (b.balance < a.balance ? b : a));
    return { days, minBalance: min.balance, minDay: min.day };
  };
  const baseline = run(false);
  const withAgent = run(true);
  return { baseline, withAgent, recovered: withAgent.minBalance - baseline.minBalance };
}
