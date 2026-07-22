# Dentle fork — status & notes

Fork of [`ArnasDon/wacrm`](https://github.com/ArnasDon/wacrm) (v0.8.0), operated
by Dentle as a **self-hosted** WhatsApp CRM. Work happens in short sessions, so
this file is the running record of what's done and what's left.

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
- **P2 (flow/automation port):** buildable now; send-dependent steps can't be
  fully validated until verification clears.
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
