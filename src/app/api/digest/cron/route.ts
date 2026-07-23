import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
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
 * Delivery is via the CRM's own WhatsApp number to the owner
 * (`DIGEST_RECIPIENT_PHONE`). While the WABA is still Meta-restricted
 * (err 131031, pending business verification) that send fails — so the
 * digest *text* is always returned in the JSON response (and logged),
 * which is the interim read surface. Once verification clears, delivery
 * starts flowing with no further code change. Failing to send never
 * fails the request: silent-to-lead, loud-to-owner (09.5 §3.3).
 *
 * Account/recipient are env-driven because this is a single-owner
 * self-host; nothing here is multi-tenant.
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
  // when WhatsApp delivery is blocked.
  console.log(`[digest-cron] digest for account ${accountId}:\n${text}`)

  let delivery: 'sent' | 'skipped' | 'failed' = 'skipped'
  let deliveryError: string | undefined

  const recipient = process.env.DIGEST_RECIPIENT_PHONE?.trim()
  if (recipient) {
    const { data: wa } = await admin
      .from('whatsapp_config')
      .select('phone_number_id, access_token, status')
      .eq('account_id', accountId)
      .maybeSingle()
    const cfgRow = wa as
      | { phone_number_id: string; access_token: string; status: string }
      | null
    if (!cfgRow || cfgRow.status !== 'connected') {
      delivery = 'skipped'
      deliveryError = 'whatsapp not connected'
    } else {
      try {
        await sendTextMessage({
          phoneNumberId: cfgRow.phone_number_id,
          accessToken: decrypt(cfgRow.access_token),
          to: recipient,
          text,
        })
        delivery = 'sent'
      } catch (err) {
        // Expected while the WABA is restricted (131031) — surface it,
        // don't throw. The digest content is still returned below.
        delivery = 'failed'
        deliveryError = err instanceof Error ? err.message : 'send failed'
        console.error('[digest-cron] delivery failed:', deliveryError)
      }
    }
  }

  return NextResponse.json({ ok: true, delivery, deliveryError, digest: text })
}
