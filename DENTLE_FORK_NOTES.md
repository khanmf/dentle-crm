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
