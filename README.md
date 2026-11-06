# Runway: an AI cash-flow copilot for micro-merchants

> Late payments kill small businesses. Runway is an AI agent that chases the money for you, kindly, and only moves with your approval.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). Licence: MIT.

## What it does

A micro-merchant's cash runs thin when clients pay late. Runway:

1. **Diagnoses.** It reads open invoices, ranks them by lateness, history and amount, and forecasts the next 30 days of cash.
2. **Plans.** A Claude-powered agent decides which clients to chase and in what tone: friendly for a first slip, firm but warm (with an instalment offer) for repeat late payers.
3. **Proposes.** Every message is a *proposal*. The agent cannot send anything or touch money by itself.
4. **Waits for you.** You can edit each message, then approve or reject. Approval sends a payment reminder through the PayPal Invoicing API.
5. **Tracks.** Payment status is read back from PayPal. The forecast and an append-only audit log update live.

The seeded demo merchant (fictional) goes from a forecast low of about -968 to a positive balance throughout when the reminders land.

## Run it

```bash
npm install
npm test
npm start          # http://localhost:3000
```

It works with **no keys** in offline demo mode (rule-based agent, mocked PayPal). Add keys to unlock the real thing:

```bash
cp .env.example .env   # fill in sandbox credentials; never commit .env
npm run seed           # creates + sends the seed invoices in your PayPal SANDBOX
npm start
```

| Mode | Needs | Behaviour |
|---|---|---|
| Agent: `offline` | nothing | Deterministic planner writes the proposals |
| Agent: `claude` | `ANTHROPIC_API_KEY` | Claude uses tools (`get_invoices`, `get_forecast`, `propose_reminder`) |
| PayPal: `mock` | nothing | Approvals are recorded; "simulate payment" button appears |
| PayPal: `sandbox` | sandbox client id/secret, `DEMO_BUYER_EMAIL`, `npm run seed` | Approvals call the Invoicing API; paying the invoice in the sandbox updates Runway |

## Architecture

```
Merchant ──▶ UI (public/) ──▶ Express API (src/server.js)
                                  │
              ┌───────────────────┼─────────────────────┐
              ▼                   ▼                     ▼
      Agent (src/agent.js)  Forecast (src/forecast.js)  PayPal (src/paypal.js)
      Claude tool-use loop  30-day scenarios            Invoicing: remind, status
      PROPOSES only         with/without reminders      SANDBOX only
              │
              ▼
   Approval queue ──▶ human edits / approves ──▶ PayPal reminder + audit log
```

Design principles: human-in-the-loop on every outbound action, explainable reasoning shown beside every proposal, full audit trail, sandbox-only credentials, model-written text rendered as plain text (no HTML injection).

## Honest status

- The PayPal Invoicing calls follow the public v2 API but have **not yet been exercised against a live sandbox** in this repo. Run `npm run seed` first and check the output.
- Sandbox invoices are created due today (PayPal may reject past due dates); overdue-ness is modelled locally.
- Figures in the demo are illustrative seed data, not statistics.

## Roadmap

Instalment plans via PayPal, webhooks instead of polling, multi-currency (MYR and ASEAN currencies), a learning loop on which tone gets paid fastest.
