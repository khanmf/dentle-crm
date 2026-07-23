# Dentle CRM — sales-agent knowledge base (paste-ready)

> **What this is:** the knowledge base to load into **Settings → AI →
> Knowledge** in the live app. The AI assistant retrieves from this to answer
> customer questions; the *style* rules live separately in the system prompt
> (`assistant_system_prompt.md`).
>
> **Provenance & honesty rule (09.5 §2.2):** every fact here is transcribed
> from the business-repo truth docs cited in each section — product facts from
> `05a_CONTENT_MASTER_PROMPT.md`, pricing from `01_COMPANY_FOUNDATION.md §4`,
> objections from `04_MARKETING_SALES_SYSTEM.md §3.3`. **A claim that can't be
> traced to a truth doc must be deleted, not defended.** Regenerate this file
> from those docs after any release or pricing change — never hand-edit it
> inside the app.
>
> ⚠️ **This file stands in for the canonical `05a_SALES_AGENT_KB.md`, which was
> never generated in the business repo.** See the D5 note in
> `DENTLE_FORK_NOTES.md` — the owner should decide whether to back-port this to
> the business repo as the canonical KB or regenerate it there in a Sonnet
> session.

---

## 1. What Dentle is

Dentle is a cloud dental clinic management app: it runs the whole clinic —
patients, appointments, charting, billing, prescriptions, analytics — from any
device. Built by a solo founder with real dentists over years. Positioning:
*"Practice management that's gentle on you."* "If you can use Google, you can
use Dentle" — nothing to install, no training needed.

## 2. Features — claimable, described exactly this way

Use **only** these, worded like this (source: `05a` Part 1):

1. **Clinical Tooth Charting** — conditions/treatments charted on individual
   tooth surfaces (mesial, distal, occlusal, buccal, lingual). **Never say
   "2D" or "3D"** — it is "Clinical Tooth Charting."
2. **Automated Billing** — procedure logged → invoice generated → sent to the
   patient on WhatsApp. No manual calculation, no end-of-day session.
3. **WhatsApp Appointment Reminders** — reminder messages to patients before
   appointments, sent from inside Dentle in one tap. Say "one tap, every
   patient, every time." **Do not** claim they send with zero human action —
   full automation ships later with the WhatsApp API rail. When in doubt,
   understate.
4. **Digital Prescription Builder** — built in seconds, sent on WhatsApp,
   searchable history, no illegible handwriting.
5. **Practice Analytics** — revenue, visits, patient patterns, tracked in real
   time.
6. **Cloud-Based Access** — phone, tablet, laptop; same live data from clinic,
   chairside, or home.
7. **Patient Management** — auto-generated registration IDs; instant lookup by
   name, mobile, or registration number; up to 4 mobile numbers per patient;
   medical history and clinical notes on one page.
8. **Smart Appointments** — calendar built for Indian morning/evening shifts;
   drag-to-reschedule; a missed-appointments list so no patient is silently
   lost; an ongoing-treatments list so no pending balance is forgotten.
9. **Lab Orders** — partner-lab directory, order tracking, payment ledger.

Also live: **multi-doctor mode**, **document center**.

**Coming soon (only ever framed as "coming soon," never live, never priced):**
X-ray/document storage, fully-automated reminders, AI voice assistant,
multi-clinic.

## 3. Trial

**7-day free trial, no credit card.** Never "30-day" (stale old asset) — it is
**7 days.**

## 4. Pricing (India) — quote ONLY if asked, with the anchor + a demo pivot

Source: `01 §4` DECIDED India ladder. Never volunteer price; never send a bare
number.

| Offer | Anchor | Price |
|---|---|---|
| Monthly | ₹999 | **₹799/mo** (UPI Autopay) |
| **Annual** | ₹11,999 | **₹7,999/yr** — early-partner (first ~300 clinics), auto-renew |
| 3 years | ₹27,999 | **₹20,999** one-time |
| 5 years | ₹39,999 | **₹29,999** one-time ("best value") |
| Lifetime | ₹69,999 | **₹49,999 + ₹899/yr AMC** |

**Standard quote wording (from 09.1 Node 4), demo pivot in the same message:**
> "Dentle is ₹7,999/year right now for early-partner clinics (regular price is
> ₹11,999). The best way to see what you get for it — want me to send you a
> couple of 15-minute demo slots?"

Value reframe when price feels high: **₹7,999/yr ≈ ₹1,000/month ≈ 2–3 patient
visits.** One missed appointment recovered by reminders pays the month.

⚠️ **Gulf / USD pricing is `PROPOSED`, not decided — DO NOT quote it.** Any
Gulf or non-India price question is escalated to a human. Never invent a
foreign-currency number.

## 5. Objection handling (source: `04 §3.3`)

- **"Too expensive" / price silence** — never discount the subscription. Use
  the ₹1,000/month = 2–3 visits framing; move down the follow-up cadence, not
  the price. The lifetime offer is a launch-window instrument, **never** a
  rescue discount.
- **"We manage fine with registers/Excel"** — ask what happens when the
  receptionist is off sick. Offer: "bring your Excel, we load your own data
  before your demo."
- **"Need to ask my partner/spouse/accountant"** — book the follow-up call in
  that moment with both parties; send the recording + a one-page pricing PDF
  for their internal conversation.
- **"Is my patient data safe / where is it stored?"** — honest current-state +
  roadmap; never wing a compliance claim (see banned claims). Say: "your data
  is yours — isolated, encrypted, backed up daily, exportable, never viewed,
  shared, or sold."
- **"Does it do X?" (a feature we don't have)** — honest no, plus roadmap
  position only if it's genuinely planned; "not planned" if not. **Never
  promise a feature mid-conversation.**

**Anything discount-shaped, or a close, is escalated — agents never discount.**

## 6. Banned claims (hard negative rules — source: `05a` Part 4)

Never say any of these:

- ❌ "2D" or "3D" charting (it is "Clinical Tooth Charting").
- ❌ Any **HIPAA** reference.
- ❌ "Pay once, own forever" / "no monthly subscriptions" identity framing —
  Dentle is subscription-first; lifetime is one row in the ladder, surfaced
  only in briefed lifetime-window campaigns.
- ❌ "Your own private database" — the platform is unified multi-tenant with
  strict per-clinic isolation. Say "your data is yours: isolated, encrypted,
  backed up daily, exportable."
- ❌ Reminders that "send themselves with zero human action" (full automation
  is a coming-soon rail).
- ❌ Invented statistics, fake registration counts (e.g. "100–150 clinics
  registered"), fake "% OFF," or manufactured urgency.
- ❌ "30-day trial" — it is **7 days**.
- ❌ Discounts, delivery-date promises, or feature promises.

When a true answer would require any banned claim, give the honest current
state instead, or hand off to a human.

## 7. Escalate to a human when

Free text outside this KB; anger; anything legal/compliance or data-safety
beyond the line above; any discount/price-exception ask; a request for the
owner by name; a multi-clinic or Gulf/overseas lead; a post-demo negotiation;
or any question you cannot answer from this KB with confidence.
