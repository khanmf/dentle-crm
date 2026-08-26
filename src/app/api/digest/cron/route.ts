import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { sendTelegramMessage } from '@/lib/notify/telegram'
import {
  DEFAULT_DIGEST_CONFIG,
  gatherDigest,
  buildDigestText,
  type DigestConfig,
} from '@/lib/digest/build'

/**
 * The daily owner digest (blueprint 09.7 §6 / 09.5 §3.2).
 *
 * Hit on a schedule by an external pinger (the `.github/workflows/
 * digest-cron.yml` GitHub Action, or cron-job.org) once a day — it
 * requires the same `x-cron-secret` / `AUTOMATION_CRON_SECRET` pair as
 * `/api/automations/cron` and `/api/flows/cron`, so operators provision
 * exactly one secret. Vercel Cron can't set a custom header, which is
 * why an external pinger owns the schedule.
 *
 * Delivery is over **Telegram** (fork decision D6). It used to go via
 * the CRM's own WhatsApp number to `DIGEST_RECIPIENT_PHONE`, which
 * carried WhatsApp's 24-hour customer-service window: unless the owner
 * had messaged himself inside the last day, the digest silently failed
 * to deliver. Telegram has no window and no per-message cost, so the
 * WhatsApp path is gone rather than kept as a fallback — a fallback
 * that only works one day in every 24 hours isn't one.
 *
 * The digest *text* is still always returned in the JSON response (and
 * logged), which is what manual runs and the GitHub Action's run logs
 * read. Failing to send never fails the request: silent-to-lead,
 * loud-to-owner (09.5 §3.3).
 *
 * Account is env-driven because this is a single-owner self-host;
 * nothing here is multi-tenant.
 */
export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  const supplied = request.headers.get('x-cron-secret') ?? ''
  const suppliedBuf = Buffer.from(supplied)
  const expectedBuf = Buffer.from(expected)
  if (
    suppliedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(suppliedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()

  // Resolve the account: explicit env override, else the sole/oldest
  // account (single-owner self-host).
  let accountId = process.env.DIGEST_ACCOUNT_ID ?? ''
  if (!accountId) {
    const { data: account } = await admin
      .from('accounts')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    accountId = (account as { id: string } | null)?.id ?? ''
  }
  if (!accountId) {
    return NextResponse.json({ error: 'no account found' }, { status: 404 })
  }

  // Config: defaults from the P1b runbook, with env overrides for the
  // cost cap and follow-up field name (in case they are renamed live).
  const cfg: DigestConfig = {
    ...DEFAULT_DIGEST_CONFIG,
    aiCostCapUsd: Number(process.env.DIGEST_AI_COST_CAP_USD) || DEFAULT_DIGEST_CONFIG.aiCostCapUsd,
    followUpFieldName:
      process.env.DIGEST_FOLLOWUP_FIELD ?? DEFAULT_DIGEST_CONFIG.followUpFieldName,
  }

  let text: string
  try {
    const data = await gatherDigest(admin, accountId, cfg)
    text = buildDigestText(data, cfg)
  } catch (err) {
    console.error('[digest-cron] gather failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'digest failed' },
      { status: 500 },
    )
  }

  // Always log the digest so a scheduler's run logs capture it even
  // when delivery is unconfigured or down.
  console.log(`[digest-cron] digest for account ${accountId}:\n${text}`)

  // Plain text, no parse_mode: the digest interpolates contact names
  // verbatim and a name containing `<` or `&` would otherwise be
  // rejected as malformed HTML by Telegram. `sendTelegramMessage`
  // never throws — a delivery failure is reported, not raised.
  //
  // No quiet-hours check here: the digest runs on a schedule the owner
  // chose (~09:05 IST), so suppressing it by clock would only ever be
  // a bug. Quiet hours belong to event-driven alerts.
  const { outcome: delivery, reason: deliveryError } =
    await sendTelegramMessage(text)

  return NextResponse.json({ ok: true, delivery, deliveryError, digest: text })
}
