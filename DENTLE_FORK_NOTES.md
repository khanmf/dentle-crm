# Dentle fork — status & notes

Fork of [`ArnasDon/wacrm`](https://github.com/ArnasDon/wacrm) (v0.8.0), operated
by Dentle as a **self-hosted** WhatsApp CRM. Work happens in short sessions, so
this file is the running record of what's done and what's left.

## ⚠️ DEFERRED — OWNER ACTIONS OUTSTANDING (P1 config + review)

**Status (2026-07-22): P1 branding code is SHIPPED and pushed. The P1 *runtime
configuration* and the *branding review* are DEFERRED — the owner chose to move
to P2 now and come back to these later.** None of the items below need WhatsApp
sending (still Meta-blocked, `131031`); they are all internal clicks in the live
app. **Nothing here is live/proven until the owner does these AND Meta business
verification clears.** How-to detail for each is in the **"P1b — runtime
configuration runbook"** section lower in this file.

- [ ] **Review the branding** on `dentle-crm.vercel.app` — new default Dentle
      teal theme, teal favicon, product name now "Dentle CRM". If disliked, it's
      a trivial revert on branch `claude/p1-crm-configuration-fyeplb`.
- [ ] **Create the "Sales" pipeline + its 9 stages** (§4.1): Fresh inquiry →
      Talks started → Seriously interested → Make ready for demo → Ready for demo
      → Demo scheduled → Demo given → Post-demo negotiating → Cold. *Why: this is
      the board the whole funnel runs on.*
- [ ] **Create the tags** `customer` (+ `plan` field) and `do-not-contact`.
      *Why: Customers and Dead are tags, not stages; `do-not-contact` is the hard
      opt-out every automation/broadcast must exclude.*
- [ ] **Create the ~12 contact custom fields** (§4.2) — incl. next-follow-up
      date, language (EN/HI/Hinglish), source, track. *Why: the follow-up +
      digest-flagging discipline and reply-mirroring depend on them.*
- [ ] **Decide §7 Q7 + invite helpers:** give the data-entry helper an inbox
      login **now** (least-privilege **Agent** role) or stay owner-only until V2
      is proven — then invite up to 2 helpers as Agent, or defer. *Why: needed
      before anyone but the owner touches the inbox.*
- [ ] **Decide §5.1 Q1 (number strategy):** approve Option A — one dedicated
      sales number (personal number + current chats stay untouched). *Why: not
      needed for P1 clicks, but P2/P4 depend on it; decide when convenient.*
- [ ] **Run the P1 exit test:** create a test lead and drag it through stages
      **1 → 7** (Fresh inquiry → Demo given). *Why: this is P1's done-definition.*

> Why deferring is safe: P2 (flow port) is build-only while send is Meta-blocked,
> and it does not require these clicks to exist first. The natural moment to do
> this checklist is one sitting later — alongside activating P2 and getting
> templates approved — once verification clears. Mirrored in the business queue
> row **S-4.6** (`Dentle-Application` repo, `claude/business-planning`).

## Decision (2026-07-22)

- **Self-host only — no BSP.** Dentle runs this fork directly; the "use a BSP"
  on-ramp is declined. Consequence: **Meta business verification is on the
  critical path to any live WhatsApp automation** (no BSP fallback).

## P0 spike (2026-07-22) — de-risking results

Deployed to Vercel (`dentle-crm.vercel.app`) + a fresh Supabase project + a Meta
**test** number.

**Working ✅**
- Vercel build — needs env vars: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`,
  and `META_APP_SECRET` (webhook fails closed without it).
- All 36 Supabase migrations applied.
- Login/signup — set Supabase Auth **Site URL** to the Vercel URL and add a
  redirect URL; disable "Confirm email" (or confirm via email) so links don't
  point at `localhost`.
- WhatsApp credentials connect (system-user permanent token; "Credentials valid").
- Webhook verified + **`messages`** field subscribed.
- **Inbound receive works** — customer messages land in the Inbox.

**Blocked ❌ — outbound send**
- Root cause (confirmed via the delivery-status webhook and Business Support
  Home): the WhatsApp Business Account is **"Account restricted — Permanent"**,
  error **`131031` "Business Account locked."** Meta's only remedy is
  **business verification.** Not a defect in this app.

## TOP pending priority — business verification (unlocks sending)

1. **Udyam/MSME registration** (free, `udyamregistration.gov.in`): Aadhaar + PAN,
   trade name "Dentle", activity = software/IT → Udyam certificate.
2. **Meta Business Verification** (Security Center → *Start Verification*): legal
   name matching the certificate, business address, a verifiable business phone,
   website/domain + business email; upload the Udyam certificate; keep a **backup
   proof** (bank statement / utility bill in the business name) ready. Review:
   minutes–days.
   - Honest risk: Udyam alone may not satisfy Meta — have the backup proof ready.

## Phase readiness (as of 2026-07-22)

- **P1 (config: pipeline stages, custom fields, branding, users):** doable now —
  no WhatsApp sending required. P1 exit test (13-list board + a lead walks
  stages 1→7) is internal CRM data.
- **P2 (flow/automation port):** buildable now; **spec'd out — see the "P2 —
  flow port" section at the bottom** (Flows build map + price automation + Meta
  template definitions); send-dependent steps can't be fully validated until
  verification clears.
- **P3 (AI/brain — KB, AI draft, digest):** AI *drafts* are testable now;
  auto-send/broadcast waits.
- **P4 (go-live):** blocked until verification + a real/dedicated number.

> Governance note: per the blueprint's §9, P1+ are formally gated (V1 stable ≥2
> weeks, M0 done, owner green-light). Proceeding ahead of that is the owner's call.

## P1 — configuration (2026-07-22)

Branch: `claude/p1-crm-configuration-fyeplb`. Doctrine held: **configure, don't
code** — the only code touched is branding. Pipeline stages, custom fields, and
users are configured at **runtime in the running app**, not in code. Nothing in
P1 depends on outbound send (still Meta-blocked, `131031`).

### P1a — branding changes shipped (code)

Surgical rebrand wacrm → Dentle. Files:

- **`src/lib/themes.ts` + `src/app/globals.css`** — added a new **`dentle` teal
  theme** and set it as `DEFAULT_THEME`. Teal `--primary` `oklch(0.6 0.11 183)`
  (≈ `#0d9488`), hover `oklch(0.7 0.13 182)` (≈ `#14b8a6`). `:root` fallback now
  points at the dentle block (no pre-boot flash). The 5 upstream themes
  (violet/emerald/cobalt/amber/rose) are kept, so the picker still offers them.
- **`src/app/icon.tsx`** — favicon square `#7c3aed` → `#0d9488` (Dentle teal);
  white chat glyph unchanged.
- **`messages/en.json`** — `Sidebar.title` "CRM Template for WhatsApp" →
  **"Dentle CRM"** (the name in the sidebar header); user-facing "wacrm" product
  mentions (invite message, template delete/registration/BYO-key help) → "Dentle
  CRM".
- **`src/app/layout.tsx`** — `<title>` default/template → "Dentle CRM".
- **`src/components/settings/invite-member-dialog.tsx`** — "our wacrm account"
  fallback → "our Dentle CRM account".
- **`package.json`** (`name` → `dentle-crm`) + **`README.md`** H1/tagline →
  Dentle, with a link crediting the upstream WACRM (MIT) fork.

**Deliberately NOT renamed** (functional identifiers, not branding — renaming
would break running integrations): API-key prefix `wacrm_live_`, webhook headers
`X-Wacrm-*`, env var names `WACRM_*`, `mcp-server/` package identity,
`wacrm.theme`/`wacrm.mode` localStorage keys, the `wacrm.tech` invite-URL
fallback. `messages/ko.json` (Korean) left as-is — Dentle's locales are
EN/HI/Hinglish. Upstream `author`/`homepage`/`repository` in `package.json` kept
for correct MIT attribution.

Verified: `npm run typecheck` clean; `npm run build` green (with placeholder
Supabase/Meta env vars — the build's known env requirement, unrelated to
branding). Manual visual check of the rendered teal theme / favicon still
recommended on the Vercel preview.

### P1b — runtime configuration runbook (owner does this in the live app)

All of the below is **admin-only** in the running app; the owner (Owner role)
performs it. Nothing here is code.

**1. Pipeline "Sales" — 9 stages (blueprint §4.1).** Go to **Pipelines** (left
nav) → create/rename a pipeline named **Sales** → set its stages, in this exact
order:

1. Fresh inquiry
2. Talks started
3. Seriously interested
4. Make ready for demo
5. Ready for demo
6. Demo scheduled
7. Demo given
8. Post-demo negotiating
9. Cold

> **Customers and Dead are NOT stages — they are TAGS.** A closed-won card leaves
> the board and gets a `customer` tag (+ a `plan` field: annual/lifetime/other).
> A closed-lost / opt-out gets a hard `do-not-contact` tag that every automation
> and broadcast excludes by definition. Create these two tags under **Settings →
> Tags and custom fields**.

**2. Contact custom fields (blueprint §4.2).** **Settings → Tags and custom
fields → Custom fields.** Add each (suggested type in brackets):

- stage — mirrors the pipeline [select]
- demo done — [yes/no]
- trial — [yes/no] + trial end date [date]
- existing software — free text (competitors: HealthClicks, Doctor Click) [text]
- budget issue — [yes/no]
- feature request — [text]
- last contact date — [date]
- interest level — [select: low/medium/high]
- **next follow-up date** — [date] (the "silence never closes a deal" field; the
  digest flags any active-stage contact without one)
- source — [select/text: organic / ad / collab / campaign-ID]
- language — [select: EN / HI / Hinglish] (reply-mirroring needs it)
- track — [select: India / Gulf] (from country code)

**3. Users — least privilege (blueprint §7).** **Settings → Team members →
Invite member.**

- Owner = **Owner** role (full control).
- Up to 2 helpers = **Agent** role. Confirmed correct: the app's own role hint
  for Agent is *"Use features; no settings"*, and `src/lib/auth/roles.ts` gates
  `canEditSettings`/`canManageMembers` at Admin+ — so an Agent gets the
  inbox/agent surface but **cannot** reach settings or keys. Do **not** give a
  helper Admin/Owner.

**4. Exit test (P1 done-definition).** In the live app: confirm the board
mirrors the 13-list model (9 Sales stages + `customer`/`do-not-contact` tags),
then create a **test lead** and drag it through **stages 1 → 7** (Fresh inquiry
→ Demo given). When that walk works, P1 is complete.

### §10 owner decisions this phase surfaces (parked, owner's call)

- **§5.1 number strategy (Q1):** approve **Option A** (one dedicated sales number
  bought at V1, ported to V2; personal number + all current chats stay untouched
  in the phone app). Not needed for P1 config, but P2/P4 depend on it.
- **§7 helper access (Q7):** give the data-entry helper an Agent inbox login
  **now**, or stay owner-only until V2 is proven? The Users step above needs this
  answer before any helper is invited.
- Rest of §10 (infra, assistant convergence, HubSpot retirement, the friend)
  parked — none block P1.

### P1 status

- **P1a branding: shipped** (code, this branch).
- **P1b configuration: guided, owner-action** — the runbook above is the
  hand-off; the exit test is performed by the owner in the live app (it needs no
  code and no sending).

---

## P2 — flow port (2026-07-22)

Branch: `claude/p1-crm-configuration-fyeplb` (continues P1 — the harness-default
`claude/dentle-crm-flow-port-jrloyg` is 3 commits behind and has neither the P1
branding nor these notes, so P2 stays on the P1 branch per the owner's task).
Doctrine held: **configure, don't code.** No app code was written in P2 — the
fork's builders already express the whole 09.1 flow (P0 verified `send_buttons`/
`send_list` with per-button branching + full template lifecycle). This section is
the **execution-ready build spec + template definitions**; like P1b, the actual
clicks and the Meta template submission are **owner-action in the live app**
(there is no builder-as-code seed for flows — flows live in Supabase rows created
by the visual builder; see the D3 decision below for the one code option).

**Send still Meta-blocked (`131031`, account restricted → business verification).**
So P2 is **build-only**: the flow and templates get *built and submitted*, but
live send/parity can't be validated until verification clears. The §9 gate is
formally still open — proceeding is the owner's call (unchanged from P0/P1).

### What the fork gives us (verified against this branch's source)

Two builders, and the 09.1 flow needs **both**:

- **Flows** (left nav → **Flows**, beta) — a visual node canvas, conversation-
  driven. Trigger `first_inbound_message`; node types `start`, `send_message`,
  `send_buttons`, `send_list`, `send_media`, `collect_input`, `condition`,
  `set_tag`, `handoff`, `end`; every button/list row carries its own
  `next_node_key`, so branching is native. A per-flow **fallback policy**
  (`on_unknown_reply: reprompt | handoff | ignore`, `max_reprompts`,
  `on_timeout_hours`, `on_exhaust`) handles free-text-after-a-button.
  (Types: `src/lib/flows/types.ts`.)
- **Automations** (left nav → **Automations**) — trigger→steps, event/schedule
  driven. Triggers incl. `keyword_match`, `interactive_reply`, `tag_added`,
  `time_based`; steps incl. `send_message`, `send_template`, `add_tag`,
  `create_deal`, `wait` (min/hours/days), `condition`. `wait` enqueues a
  `automation_pending_executions` row drained by `GET /api/automations/cron`
  (needs `AUTOMATION_CRON_SECRET` + a scheduler — see infra note).
  (Types: `src/types/index.ts` `AutomationTriggerType`/`AutomationStepType`.)

### A. Main conversational flow (Nodes 1–3, 5–7) → build in **Flows**

Create one flow, **"Dentle — Qualification & Booking"**, trigger
**First Message from Contact** (`first_inbound_message`), fallback policy
`on_unknown_reply: handoff` (this is what mechanises 09.1's "any free text that
isn't a button tap → route to a human, stop automating" doctrine — §2 Node 3 /
§3). Nodes (node_key → type → config essentials, branch targets in **bold**):

1. `start` → **start** → next: `greet`.
2. `greet` → **send_buttons** — text: *"Hi! 👋 Thanks for reaching out about
   Dentle. I'll get you sorted quickly — mind two quick taps?"*; buttons:
   `[Sure, go ahead]`(reply_id `go`, →**`q_chairs`**) · `[Just send me info]`
   (reply_id `info`, →**`async_offer`**).  *(09.1 Node 1)*
3. `q_chairs` → **send_buttons** — *"Great — how many dental chairs does your
   clinic run?"*; buttons `[1–2]`/`[3–5]`/`[6+]` (reply_ids `c12`/`c35`/`c6`) —
   **all three → `q_software`** (bucket captured; not gating).  *(Node 2)*
4. `q_software` → **send_buttons** — *"Got it. And what are you using today?"*;
   `[Paper / Excel]`/`[Another software]`/`[Nothing yet]` — **all three →
   `book_offer`**. Optionally precede with `set_tag`/`update_contact_field` to
   record the answer. Answer is non-gating (Node 3 doctrine).  *(Node 3)*
5. `book_offer` → **send_list** — *"Whenever you're ready, here are a couple of
   times — pick whichever works:"*, button_label *"See times"*; rows = 2–3 live
   demo slots. **⚠ Slots are external (Cal.com/Calendly); the CRM has no calendar
   integration** — either hard-code a "book here" link row (send_message with the
   Cal.com URL) or maintain the list manually. On selection → `set_tag`
   **Demo-Booked** → `end`. *(Node 5 — see reminder note B.)*
6. `async_offer` → **send_buttons** — *"No worries if a call's tough right now — I
   can send you a short recorded walkthrough instead. Want that?"*; `[Yes, send
   it]`(→**`send_async`**) · `[I'll book later]`(→**`nudge_later`**). *(Node 6)*
7. `send_async` → **send_media** (the 10-min walkthrough — **does not exist yet**,
   §3.2; until then send the brochure + screenshots and tag *Sent-Brochure*) →
   `end`.
8. `nudge_later` → **set_tag** *Nurture* → `end`. The single +24h no-response
   nudge (Node 6) is **outside the 24h window → a template**, not a flow node —
   see template T4 (optional) in section C.
9. **Node 7 (disqualification)** is a human/keyword judgment call, not a button
   branch. Handle via the fallback `handoff` + a manual `handoff` node the agent
   can't pre-wire; keep the copy from 09.1 Node 7 as a saved reply. Not
   auto-built.

### B. Price-if-asked (Node 4) → **Automations**, keyword trigger

09.1 §5 is explicit: price is a **standing intent**, not a linear node. Build an
Automation, trigger **Keyword Match** (`keyword_match`), keywords: `price, cost,
how much, ₹, $, AED, fee`, match_type `contains`. Steps:

- **India track:** `send_message` — *"Dentle is ₹7,999/year right now for
  early-partner clinics (regular price is ₹11,999). Best way to see what you get
  for it — want me to send you a couple of 15-minute demo slots?"* (never a bare
  number; demo pivot in the same message — §5 Node 4 DECIDED).
- **⚠ Do NOT build the Gulf price branch.** The Gulf $ figures are still
  `PROPOSED` in `01` §4 (only the India ladder is owner-DECIDED). Gulf-track price
  questions **route to the human-attention tag** (add a `condition` on the
  `track` custom field = `Gulf` → `add_tag` *Needs-Human* + `assign_conversation`;
  otherwise send the India message). Build the Gulf reply only after the owner
  approves `01` §4.

**Honest engine interaction (validate once send unblocks):** if a price question
is typed *mid-active-flow-run*, the Flows engine may consume it as an unknown
reply first (→ `handoff` per the fallback policy) so the keyword Automation
won't also fire. That's on-doctrine (a real conversation gets a real human, Node
3), but it means the auto price reply reliably covers price-as-first-message /
after the flow ends, not every mid-flow case. Acceptable; flagged as a
send-blocked parity item.

**Country/track detection (09.1 §1) is NOT native.** The fork doesn't parse the
E.164 country code into a Gulf/India `track`. Until a small bridge exists, set
`track` manually (or default India, since ads currently target India) — the Gulf
branch is parked anyway. Logged as decision D4 dependency, not built.

### C. Templates to submit for Meta approval (Settings → Templates → New)

Everything in section A (Nodes 1–6 answering an *active* conversation) stays
inside WhatsApp's 24h window and needs **no template**. Only the messages sent
**outside** the window need pre-approved templates. Submit these (all category
**Utility** — near-free, ~₹0.12 vs marketing ~₹0.86; language `en`; the app's
submit flow is `POST /api/whatsapp/templates/submit` → Meta). Placeholders are
Meta positional `{{1}}`, `{{2}}`:

- **T1 `demo_confirmation`** (Utility) — body: *"You're booked! Your Dentle demo
  is confirmed for {{1}}. Here's the link: {{2}}. See you then!"* — vars: `{{1}}`
  datetime, `{{2}}` meeting link.
- **T2 `demo_reminder_24h`** (Utility) — body: *"Quick reminder — your Dentle demo
  is tomorrow at {{1}}. Here's the link: {{2}}. See you then!"*
- **T3 `demo_reminder_1h`** (Utility) — body: *"Quick reminder — your Dentle demo
  is in an hour at {{1}}. Here's the link: {{2}}. See you then!"*
- **T4 `booking_nudge` (optional, Marketing)** — the single +24h no-response nudge
  (Node 6): *"Just checking in — still happy to set up a time whenever works for
  you. No pressure!"* Marketing-category if the BSP/Meta classifies it as
  promotional; send exactly once (no second identical nudge — §5 Node 6).

Submission notes / honest gotchas:
- **`WHATSAPP_TEMPLATES_DRY_RUN=true`** lets the whole submit UI be exercised
  without a live Meta call (writes a `dry-run-*` id, status PENDING) — useful to
  author + validate the payloads now. **Real** approval needs a real submission.
- **Template submission itself may be gated by the same account restriction**
  (`131031`) — template *approval* is a separate capability from *messaging*, but
  a locked WABA can also refuse template creation. **Verify once, in the live
  app**; if it refuses, templates wait on business verification alongside send.

### The T-24h / T-1h reminder scheduling gap (real, surface as D4)

The templates above can be authored/submitted now, but **WACRM cannot natively
schedule them relative to a per-lead booked slot.** `time_based` automations are
absolute cron/HH:mm; `wait` is a delay measured *from the automation's start*,
not "24h before an external Cal.com/Calendly slot." The CRM never learns the
booked datetime (booking is external, §4 unchanged). So a true T-24h/T-1h
reminder needs one of:
- **(recommended) let Cal.com/Calendly own the timed reminders** — both send
  native WhatsApp/email workflow reminders and are the only system that knows each
  lead's slot time. Then T1–T3 above are only needed if WACRM is chosen as the
  sender.
- **a small webhook bridge** (Cal.com booking webhook → CRM `send_webhook`/
  automation storing the slot datetime + enqueuing sends) — this is **code beyond
  the three sanctioned zones → owner decision (D4)**, not built here.
- **manual**: owner sets a demo-datetime custom field + the §6 digest flags it.

### Infra note (for whoever activates P2/P3)

Scheduled automations (`wait`, `time_based`) and the P3 digest all depend on the
cron drain `GET /api/automations/cron` (+ `/api/flows/cron`), which needs
`AUTOMATION_CRON_SECRET` set and a scheduler hitting it (Vercel Cron or an
external pinger). There is **no `vercel.json` cron configured** in the repo yet —
set this up before relying on any delayed/scheduled step.

### §10 owner decisions P2 forces (parked, owner's call)

- **D3 — flow as a code template vs hand-build.** The fork has a first-class
  starter-flow registry (`src/lib/flows/templates.ts`, "editing in source is the
  lowest-friction way to add the next template"). Adding the section-A flow there
  makes the owner's build one click (New from template → review → activate) and is
  additive/reversible/upstream-portable — **but it's a code edit outside the three
  sanctioned zones (branding/digest/bug-fix)**, so per the "configure, don't code"
  doctrine it needs an owner OK first. Default (chosen here): **hand-build from
  this spec at runtime**, no code. Owner: want the one-click template instead?
- **D4 — who owns the T-24h/T-1h reminders** (Cal.com/Calendly native workflows
  **[recommended]** vs a WACRM webhook bridge that needs sanctioned-zone code)?
  Blocks fully-automated reminders; templates T1–T3 are authored either way.
- Reaffirms **§5.1 Q1 (number strategy, Option A)** — P2's booking/reminder path
  and P4 both depend on the dedicated sales number.
- Rest of §10 (infra pick, assistant convergence, HubSpot retirement, the friend)
  still parked.

### P2 status

- **Flow + price-automation + templates: SPEC'd and ready to build** (this
  section is the hand-off). No code shipped (doctrine).
- **Build + Meta submission: owner-action in the live app**, one sitting —
  naturally paired with the deferred P1b clicks once business verification clears.
- **Exit test (§8: side-by-side parity with the BSP flow on the test number):
  BLOCKED on send** (`131031`) — the conversational nodes can be walked on the
  test number as far as inbound allows, but confirmation/reminder sends and true
  parity wait on verification.
