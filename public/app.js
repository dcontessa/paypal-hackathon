const $ = (id) => document.getElementById(id);
const money = (n) => (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('en-GB');
let current = null;

// Build elements with textContent only, so model-written text can never inject HTML.
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e[k] = v;
  }
  for (const k of kids) e.append(k);
  return e;
}

async function api(path, method = 'GET', body) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

function chart(f) {
  const W = 640, H = 220, P = 34;
  const all = [...f.baseline.days, ...f.withAgent.days].map((d) => d.balance);
  const lo = Math.min(0, ...all), hi = Math.max(...all);
  const x = (d) => P + (d / 30) * (W - P * 2);
  const y = (b) => H - P - ((b - lo) / (hi - lo || 1)) * (H - P * 2);
  const line = (days) => days.map((d) => `${x(d.day).toFixed(1)},${y(d.balance).toFixed(1)}`).join(' ');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Cash balance forecast over 30 days');
  const add = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
    return n;
  };
  add('line', { x1: P, x2: W - P, y1: y(0), y2: y(0), stroke: 'currentColor', 'stroke-opacity': '.25', 'stroke-dasharray': '4 4' });
  add('polyline', { points: line(f.baseline.days), fill: 'none', stroke: 'var(--base)', 'stroke-width': 2.5 });
  add('polyline', { points: line(f.withAgent.days), fill: 'none', stroke: 'var(--brand)', 'stroke-width': 2.5 });
  const t = add('text', { x: P, y: 14, fill: 'currentColor', 'font-size': 12 });
  t.textContent = `Low point: ${money(f.baseline.minBalance)} (day ${f.baseline.minDay}) → ${money(f.withAgent.minBalance)} with reminders`;
  const z = add('text', { x: 4, y: y(0) + 4, fill: 'currentColor', 'font-size': 11, opacity: '.6' });
  z.textContent = '0';
  const d0 = add('text', { x: P, y: H - 8, fill: 'currentColor', 'font-size': 11, opacity: '.6' });
  d0.textContent = 'today';
  const d30 = add('text', { x: W - P - 40, y: H - 8, fill: 'currentColor', 'font-size': 11, opacity: '.6' });
  d30.textContent = 'day 30';
  return svg;
}

function renderInvoices(s) {
  const t = $('invoices');
  t.replaceChildren(
    el('tr', {}, ...['Client', 'Amount', 'Overdue', 'Status'].map((h, i) => el('th', { class: i === 1 ? 'num' : '' }, h))),
    ...s.invoices.map((i) =>
      el(
        'tr',
        {},
        el('td', {}, i.client),
        el('td', { class: 'num' }, money(i.amount)),
        el('td', {}, i.daysOverdue ? `${i.daysOverdue}d` : 'not due'),
        el(
          'td',
          {},
          i.status === 'PAID'
            ? el('span', { class: 'tag paid' }, 'paid')
            : el('span', { class: `tag ${i.risk}` }, i.reminded ? `${i.risk} · reminded` : i.risk),
          i.status === 'OPEN' && s.mode.paypal === 'mock' && i.reminded
            ? el('button', { onclick: () => act(() => api(`/api/invoices/${i.id}/simulate-payment`, 'POST')), title: 'Demo only' }, ' simulate payment')
            : '',
        ),
      ),
    ),
  );
}

function renderProposals(s) {
  $('proposals').replaceChildren(
    ...s.proposals.map((p) => {
      const ta = el('textarea', { value: p.note, disabled: p.status !== 'pending' });
      const row = el('div', { class: 'row' });
      if (p.status === 'pending') {
        row.append(
          el('button', { class: 'approve', onclick: () => act(() => api(`/api/actions/${p.id}/approve`, 'POST', { note: ta.value })) }, 'Approve & send'),
          el('button', { onclick: () => act(() => api(`/api/actions/${p.id}/reject`, 'POST')) }, 'Reject'),
        );
      } else {
        row.append(el('span', { class: 'muted' }, p.status === 'executed' ? `Sent via ${p.channel}` : 'Rejected'));
      }
      return el(
        'div',
        { class: 'proposal' },
        el('strong', {}, `${p.client} · ${money(p.amount)} · ${p.tone}`),
        el('p', { class: 'muted' }, `Why: ${p.rationale}`),
        ta,
        row,
      );
    }),
  );
}

function render(s) {
  current = s;
  $('merchant').textContent = `${s.merchant.name} · ${s.merchant.tagline}`;
  $('modes').replaceChildren(
    el('span', { class: `pill ${s.mode.paypal === 'sandbox' ? 'live' : ''}` }, `PayPal: ${s.mode.paypal}`),
    el('span', { class: `pill ${s.mode.agent === 'claude' ? 'live' : ''}` }, `Agent: ${s.mode.agent}`),
  );
  $('forecast-note').textContent = s.forecast.recovered > 0 ? `Approving reminders could lift your low point by ${money(s.forecast.recovered)}.` : '';
  $('chart').replaceChildren(chart(s.forecast));
  renderInvoices(s);
  renderProposals(s);
  $('log').replaceChildren(
    ...s.log.map((l) => el('li', {}, el('time', {}, new Date(l.at).toLocaleTimeString('en-GB')), `[${l.kind}] ${l.text}`)),
  );
}

async function refresh() {
  render(await api('/api/state'));
}

async function act(fn) {
  try {
    await fn();
  } catch (err) {
    alert(err.message);
  }
  await refresh();
}

$('run').addEventListener('click', async () => {
  const btn = $('run');
  btn.disabled = true;
  btn.textContent = 'Thinking…';
  $('trace').replaceChildren(el('li', { class: 'muted' }, 'Agent is reviewing your receivables…'));
  try {
    const { trace } = await api('/api/agent/run', 'POST');
    $('trace').replaceChildren(...trace.map((t) => el('li', { class: t.type }, t.text)));
  } catch (err) {
    $('trace').replaceChildren(el('li', {}, `Error: ${err.message}`));
  }
  btn.disabled = false;
  btn.textContent = 'Review my receivables';
  await refresh();
});

refresh();
setInterval(() => current && refresh().catch(() => {}), 8000);
