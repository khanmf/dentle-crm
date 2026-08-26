# THE CONFIG SITTING — do this in one go, then run the exit tests

> **What this is:** every remaining click, in the order you actually do them,
> to get the CRM from "deployed but empty" to "P4-ready". Nothing here is code.
> Nothing here needs a Claude session — follow it top to bottom yourself.
>
> **Why it exists:** the same steps are scattered across `DENTLE_FORK_NOTES.md`
> in the order they were *written* (P1 → P2 → P3), not the order you *do* them.
> This file is the doing-order version. The fork notes stay the reasoning
> record; this is the worksheet.
>
> **Time:** roughly 1.5–2.5 hours for Part 1–4, plus Meta's template review wait.
>
> **Prerequisite (already true as of 2026-08-08):** Meta Business Verification
> approved, `131031` lifted, send confirmed working both directions.
>
> Tick as you go. If something is unclear, the *why* is in
> `DENTLE_FORK_NOTES.md`.

---

## PART 1 — Pipeline, tags, fields (~30 min)

Left nav → **Pipelines**. Create a pipeline named **Sales** with these 9
stages, in this exact order:

- [ ] 1. Fresh inquiry
- [ ] 2. Talks started
- [ ] 3. Seriously interested
- [ ] 4. Make ready for demo
- [ ] 5. Ready for demo
- [ ] 6. Demo scheduled
- [ ] 7. Demo given
- [ ] 8. Post-demo negotiating
- [ ] 9. Cold

> **Customers and Dead are NOT stages — they are tags.** A won deal leaves the
> board and gets a `customer` tag. A lost/opt-out gets `do-not-contact`.

**Settings → Tags and custom fields → Tags:**

- [ ] `customer`
- [ ] `do-not-contact`  ← every automation and broadcast excludes this, always

**Settings → Tags and custom fields → Custom fields** (type in brackets):

- [ ] stage [select]
- [ ] demo done [yes/no]
- [ ] trial [yes/no]
- [ ] trial end date [date]
- [ ] existing software [text]
- [ ] budget issue [yes/no]
- [ ] feature request [text]
- [ ] last contact date [date]
- [ ] interest level [select: low/medium/high]
- [ ] **next follow-up date [date]**  ← the digest alarm reads this one
- [ ] source [select/text: organic / ad / collab / campaign-ID]
- [ ] language [select: EN / HI / Hinglish]
- [ ] track [select: India / Gulf]
- [ ] plan [select: annual / lifetime / other]

> ⚠️ **Name "next follow-up date" exactly that.** The digest job looks it up by
> name. If you rename it, set `DIGEST_FOLLOWUP_FIELD` on Vercel to match.

**✅ P1 EXIT TEST:** create a test lead, drag it **stage 1 → 7**. If it walks,
Part 1 is done.

---

## PART 2 — The AI brain (~20 min)

Two paste-ready files live in this repo under **`docs/dentle/`**:

- [ ] Open `docs/dentle/sales_agent_kb.md` → copy all → **Settings → AI →
      Knowledge** → paste as a document
- [ ] Open `docs/dentle/assistant_system_prompt.md` → copy all → **Settings →
      AI → System prompt** → paste
- [ ] Enter your **Anthropic API key**; model: **Claude Sonnet**
- [ ] Set assistant **Active = ON**
- [ ] Set **Auto-reply = OFF**  ← draft mode. Non-negotiable until the soak.
- [ ] Go to the **Anthropic Console** and set a **$15/month hard limit**
      (the app does not enforce this itself — decision D1)

> Do this part **before** Part 3. Once draft mode is live you can test AI
> drafts on real threads while templates are still in Meta review.

**✅ P3 EXIT TEST (drafts):** open 3–4 *real past threads* in the Inbox at
different stages, hit the AI draft button on each, and compare to what you'd
have written yourself. The question is: *would I send this?* If yes, pass.

---

## PART 3 — The flow and the price automation (~45 min)

### 3a. Flow

Left nav → **Flows** → new flow, name **"Dentle — Qualification & Booking"**.

- [ ] Trigger: **First Message from Contact** (`first_inbound_message`)
- [ ] Fallback policy: **`on_unknown_reply: handoff`**  ← this is what routes
      real free-text conversations to a human instead of a bot loop

Nodes (full copy for each is in `DENTLE_FORK_NOTES.md` → "P2 — flow port" →
section A):

- [ ] `start` → next: `greet`
- [ ] `greet` — **send_buttons**: `[Sure, go ahead]` → `q_chairs` ·
      `[Just send me info]` → `async_offer`
- [ ] `q_chairs` — **send_buttons**: `[1–2]` `[3–5]` `[6+]` → all to `q_software`
- [ ] `q_software` — **send_buttons**: `[Paper / Excel]` `[Another software]`
      `[Nothing yet]` → all to `book_offer`
- [ ] `book_offer` — **send_list** with your booking link / slots →
      `set_tag: Demo-Booked` → `end`
- [ ] `async_offer` — **send_buttons**: `[Yes, send it]` → `send_async` ·
      `[I'll book later]` → `nudge_later`
- [ ] `send_async` — **send_media** → `end`
      ⚠️ *the 10-min walkthrough does not exist yet — until it does, send the
      brochure + screenshots and tag `Sent-Brochure`*
- [ ] `nudge_later` — **set_tag: Nurture** → `end`
- [ ] **Activate** the flow

### 3b. Price automation

Left nav → **Automations** → new, trigger **Keyword Match**.

- [ ] Keywords: `price, cost, how much, ₹, $, AED, fee` — match: contains
- [ ] Add a **condition** on custom field `track`:
      - `track = Gulf` → `add_tag: Needs-Human` + assign to you. **Stop.**
      - otherwise → send the India price message
- [ ] India message (exact wording, never a bare number):

> Dentle is ₹7,999/year right now for early-partner clinics (regular price is
> ₹11,999). Best way to see what you get for it — want me to send you a couple
> of 15-minute demo slots?

> ⚠️ **Do NOT build a Gulf price branch.** Those figures are still unapproved.
> Gulf price questions go to a human, full stop.

### 3c. Templates → submit to Meta

**Settings → Templates → New.** All category **Utility**, language `en`:

- [ ] `demo_confirmation` — *"You're booked! Your Dentle demo is confirmed for
      {{1}}. Here's the link: {{2}}. See you then!"*
- [ ] `demo_reminder_24h` — *"Quick reminder — your Dentle demo is tomorrow at
      {{1}}. Here's the link: {{2}}. See you then!"*
- [ ] `demo_reminder_1h` — *"Quick reminder — your Dentle demo is in an hour at
      {{1}}. Here's the link: {{2}}. See you then!"*
- [ ] *(optional, Marketing)* `booking_nudge` — *"Just checking in — still happy
      to set up a time whenever works for you. No pressure!"*

Approval takes anywhere from minutes to a day. Carry on meanwhile.

**✅ P2 EXIT TEST:** from your personal WhatsApp, message the CRM number as if
you were a brand-new lead:

- [ ] Greeting fires by itself
- [ ] Both qualification steps show buttons, and tapping advances correctly
- [ ] Booking list appears at the end
- [ ] **Send free text mid-flow** → you get handed off to a human, *not*
      re-prompted by the bot
- [ ] In a *fresh* conversation, open with **"what's the price?"** → India
      price reply with the demo pivot

---

## PART 4 — Cron and the daily digest (~15 min)

The digest and every delayed automation depend on a scheduler.

**On Vercel** (project → Settings → Environment Variables):

- [ ] `AUTOMATION_CRON_SECRET` = a long random string
- [ ] `DIGEST_RECIPIENT_PHONE` = your WhatsApp number in E.164, e.g.
      `919926728030`
- [ ] Redeploy so the variables take effect

**On GitHub** (`khanmf/dentle-crm` → Settings → Secrets and variables → Actions):

- [ ] `CRM_BASE_URL` = `https://dentle-crm.vercel.app` (no trailing slash)
- [ ] `CRM_CRON_SECRET` = the **same** value as `AUTOMATION_CRON_SECRET`

> ⚠️ The workflow `.github/workflows/digest-cron.yml` only runs from the repo's
> **default branch**. It currently lives on `claude/p1-crm-configuration-fyeplb`
> — merge that branch to `main` or the schedule never fires.

**✅ P3 EXIT TEST (digest):** Actions tab → "CRM cron pinger" → **Run
workflow**. It should return the digest text, and — now that send works — a
WhatsApp message should reach your phone.

---

## PART 5 — What you deliberately do NOT do yet

- [ ] ❌ **Do not onboard +91 99267 28030 to the Cloud API.** Irreversible: it
      leaves your phone's WhatsApp permanently and history does not transfer.
      It waits until the CRM is genuinely ready to receive. Keep using the Meta
      **test number** until then.
- [ ] ❌ **Do not turn auto-reply on.** Draft mode only, until the 2–4 week
      soak has passed.
- [ ] ❌ **Do not build the Gulf price branch.**

---

## When all boxes are ticked

You are P4-ready. Start a **fresh Claude session** for P4 (go-live) — it is a
build, and it should not share a session with anything else.

Open items that are *not* blockers: a current bank account in the name Dentle
Software (needed for Razorpay, not for this), and the DPA (keep it with a
professional; not needed until a clinic asks).
