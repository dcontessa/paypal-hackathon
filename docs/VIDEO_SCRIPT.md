# Demo video script (target 2:40, hard cap 3:00)

Format: screen recording with voiceover, no webcam. Record at 1080p, browser zoomed to 110%, notifications off.
Upload to YouTube as **Public**. Judges stop watching at 3:00, so the payment moment must land before 2:15.

**Before recording:** reload the app so seed data is fresh, run `npm run seed` once, open the PayPal sandbox buyer
inbox in a second tab, and rehearse the click path twice.

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:20 | Title card, then the dashboard with the red forecast dip | "Meet Lina, who runs a small batik studio. Her clients pay late, and in twelve days her rent and her supplier land with an empty account. Late payment is a cash-flow problem for small businesses across Malaysia, and the chasing is exhausting. [Cite the sourced statistic on screen as a caption.]" |
| 0:20–0:40 | Architecture slide (README diagram) | "Runway is an AI cash-flow copilot built on PayPal. A Claude agent reads her invoices and forecast and proposes what to do. It can never act on its own: she approves every message." |
| 0:40–1:10 | Click **Review my receivables**; the reasoning panel fills | "Watch the agent work. It ranks overdue invoices by amount and payment history, reads the forecast, and decides who to chase and how. A client who is a few days late gets a friendly nudge. A client who has been late four times gets a firm but warm message with an instalment offer." |
| 1:10–1:40 | Open one proposal, edit a word, click **Approve & send** | "Every proposal shows why the agent chose it. Lina edits the wording, approves, and Runway sends the reminder through the PayPal Invoicing API." |
| 1:40–2:15 | Switch to the sandbox buyer tab, pay the invoice, return to Runway: status flips to paid, balance line updates | "Here is the client's side. The invoice arrives, she pays with PayPal, and Runway picks up the payment. The forecast low point moves from negative to positive." |
| 2:15–2:40 | Audit log, then the closing slide | "Every agent suggestion and human decision is in the audit log. The agent suggests, the human decides, and PayPal moves the money. Runway: humans and AI, working together on cash flow." |

**Delivery notes:** speak slower than feels natural; keep the cursor still while talking; if the live payment is slow,
cut the wait in editing rather than showing a spinner.
