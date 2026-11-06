# Devpost submission text (copy into the form)

**Project name:** Runway
**Tagline:** An AI cash-flow copilot that helps small businesses get paid, with a human approving every move.

## Inspiration
Late payment is a quiet killer of small businesses. In a 2017 survey by SME Media Group and Inti International
University, 73% of Malaysian business operators regarded late payment as part of the country's business culture
([The Star, 10 Nov 2017](https://www.pressreader.com/malaysia/the-star-malaysia/20171110/281586650876493)), and
Experian's 2025 trade bureau report continues to flag slow payment cycles and tight liquidity among Malaysian SMEs
([Experian Malaysia](https://www.experian.com.my/insights-decisioning/2025/05/21/experian-trade-bureau-report-reveals-sme-resilience/)).
Most agentic-commerce demos help buyers spend. We built for the seller, who waits to be paid.

## What it does
Runway reads a merchant's open invoices, forecasts the next 30 days of cash, and uses a Claude agent to decide which
clients to chase and in what tone: friendly for a first slip, firm but warm (with an instalment offer) for repeat late
payers. Every message is a proposal. The merchant can edit it, then approve or reject. Approval sends a payment
reminder through the PayPal Invoicing API; payment status flows back from PayPal; the forecast and an audit log update.

## How we built it
Node and Express backend; a Claude tool-use loop (`get_invoices`, `get_forecast`, `propose_reminder`) that can only
propose; a scenario forecast engine; a PayPal sandbox Invoicing client; a plain-HTML dashboard with a live reasoning
panel. The app also runs in an offline demo mode with a rule-based planner so anyone can try it without keys.

## Responsible AI by design
The agent cannot send, spend or contact anyone without explicit human approval. Its reasoning is shown beside every
proposal, all decisions are logged, credentials are sandbox-only, and model-written text is rendered as plain text.

## Challenges
Making the forecast tell an honest story, keeping the agent from over-chasing clients who are not yet overdue, and
designing the approval step so it adds trust without slowing the merchant down.

## What's next
Instalment plans through PayPal, webhooks instead of polling, MYR and other ASEAN currencies, and learning which
message styles recover payment fastest.

## Built with
Node.js, Express, Claude API, PayPal Invoicing API (sandbox), JavaScript, SVG.

## Links to add before submitting
- Repo: <https://github.com/dcontessa/paypal-hackathon> (public, MIT licence)
- Live demo: `<RENDER URL>`
- Video: `<YOUTUBE URL>` (public, under 3:00)

## Pre-submit checklist
- [ ] Repo is public and the MIT LICENSE shows on GitHub
- [ ] `npm run seed` succeeded and one real sandbox reminder and payment worked on camera
- [ ] No keys or `.env` committed
- [ ] Statistics re-checked against the cited sources (the 73% figure is from 2017; say so)
- [ ] Video under 3:00, public, and shows the project running end to end
- [ ] Submitted at least a day before 12 Nov 12:00 PM PST (4:00 AM 13 Nov Malaysia time)
