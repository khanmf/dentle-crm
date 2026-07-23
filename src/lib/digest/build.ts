// ============================================================
// Daily owner digest — data gathering + text formatting.
//
// This is the "one piece of custom code V2 genuinely needs" from the
// 09.7 blueprint §6 (mirrored in 09.5 §3.2): a once-a-day summary the
// owner reads to re-enter the funnel. It is deliberately small and
// query-only — it never writes CRM data and never messages a lead.
//
// The five blueprint lines, plus a sixth cost-guard line that is the
// sanctioned "digest guard" half of decision D1 ($15/mo LLM cap):
//
//   1. New leads by stage (deals created in the last 24h)
//   2. Drafts awaiting your reply       (see note on "drafts" below)
//   3. Post-demo negotiating (list 8)   — the owner's territory
//   4. Demos scheduled                  — protect the show-up
//   5. Active-stage contacts with NO next-follow-up date (the alarm)
//   6. AI spend this month vs the cap   — D1 guard
//
// NOTE on "drafts awaiting approval": this fork does not persist AI
// drafts — the inbox generates a suggestion on demand and the agent
// approves/sends it. So there is no draft queue to count. In draft
// mode the operationally-equivalent queue is "open conversations whose
// last inbound is unanswered", which we read from `unread_count > 0`.
// That is the honest stand-in and is what the owner actually clears.
//
// Stage names are matched against the P1b runbook's Sales-pipeline
// stage names; they are overridable via env in case the owner renames
// a stage in the live app (see route.ts).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

/** The nine Sales-pipeline stages from the P1b runbook (blueprint §4.1). */
export const DEFAULT_ACTIVE_STAGES = [
  'Fresh inquiry',
  'Talks started',
  'Seriously interested',
  'Make ready for demo',
  'Ready for demo',
  'Demo scheduled',
  'Demo given',
  'Post-demo negotiating',
] as const

export interface DigestConfig {
  /** Stage names treated as "active" for the no-follow-up alarm. */
  activeStages: string[]
  /** Stage whose deals are demos to protect (line 4). */
  demoStage: string
  /** Stage that is the owner's negotiating territory (line 5 / list 8). */
  negotiatingStage: string
  /** Custom field name that holds the next-follow-up date. */
  followUpFieldName: string
  /** Monthly LLM spend cap in USD (D1). */
  aiCostCapUsd: number
  /** How many contact names to list inline before collapsing to "+N more". */
  maxNames: number
}

export const DEFAULT_DIGEST_CONFIG: DigestConfig = {
  activeStages: [...DEFAULT_ACTIVE_STAGES],
  demoStage: 'Demo scheduled',
  negotiatingStage: 'Post-demo negotiating',
  followUpFieldName: 'next follow-up date',
  aiCostCapUsd: 15,
  maxNames: 5,
}

/** Rough per-million-token USD prices, used only for the cap-guard
 *  estimate. No prompt-cache discount is modeled, so the estimate runs
 *  high — the safe direction for a guard. Keyed by a substring of the
 *  stored model id. */
const MODEL_PRICES: Array<{ match: RegExp; inPerM: number; outPerM: number }> = [
  { match: /haiku/i, inPerM: 0.8, outPerM: 4 },
  { match: /sonnet/i, inPerM: 3, outPerM: 15 },
  { match: /opus/i, inPerM: 15, outPerM: 75 },
  { match: /gpt-4o-mini|4o-mini/i, inPerM: 0.15, outPerM: 0.6 },
  { match: /gpt-4o|4o/i, inPerM: 2.5, outPerM: 10 },
]

function estimateRowCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const price =
    MODEL_PRICES.find((p) => p.match.test(model)) ??
    // Unknown model → price as Sonnet (a sensible mid/high default so
    // the guard never under-reports spend).
    { inPerM: 3, outPerM: 15 }
  return (
    (promptTokens / 1_000_000) * price.inPerM +
    (completionTokens / 1_000_000) * price.outPerM
  )
}

export interface DigestData {
  newLeadsByStage: Array<{ stage: string; count: number }>
  awaitingReply: number
  negotiating: { count: number; names: string[] }
  demos: { count: number; names: string[] }
  noFollowUp: { count: number; names: string[] }
  aiSpend: { usd: number; capUsd: number; overCap: boolean }
  generatedAt: string
}

type DealRow = {
  id: string
  title: string | null
  created_at: string
  stage_id: string
  contact_id: string
}

/**
 * Run the digest queries for one account against the service-role
 * client (RLS is bypassed; we scope every query by `account_id`).
 */
export async function gatherDigest(
  admin: SupabaseClient,
  accountId: string,
  cfg: DigestConfig,
  now: Date = new Date(),
): Promise<DigestData> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString()

  // Stage id -> name map for this account's pipelines.
  const { data: stages } = await admin
    .from('pipeline_stages')
    .select('id, name, pipelines!inner(account_id)')
    .eq('pipelines.account_id', accountId)
  const stageName = new Map<string, string>()
  for (const s of (stages ?? []) as Array<{ id: string; name: string }>) {
    stageName.set(s.id, s.name)
  }

  // Active deals for the account (the board), with their contact.
  const { data: dealRows } = await admin
    .from('deals')
    .select('id, title, created_at, stage_id, contact_id')
    .eq('account_id', accountId)
    .eq('status', 'active')
  const deals = (dealRows ?? []) as DealRow[]

  // Contact id -> display name, for the inline name lists.
  const contactIds = [...new Set(deals.map((d) => d.contact_id))]
  const contactName = new Map<string, string>()
  if (contactIds.length) {
    const { data: contacts } = await admin
      .from('contacts')
      .select('id, name, phone')
      .in('id', contactIds)
    for (const c of (contacts ?? []) as Array<{
      id: string
      name: string | null
      phone: string
    }>) {
      contactName.set(c.id, c.name?.trim() || c.phone)
    }
  }
  const nameOf = (d: DealRow) => contactName.get(d.contact_id) ?? 'Unknown'

  // 1. New leads (deals) created in the last 24h, grouped by stage.
  const newByStage = new Map<string, number>()
  for (const d of deals) {
    if (d.created_at >= dayAgo) {
      const name = stageName.get(d.stage_id) ?? 'Unassigned stage'
      newByStage.set(name, (newByStage.get(name) ?? 0) + 1)
    }
  }
  const newLeadsByStage = [...newByStage.entries()]
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count)

  // 2. Open conversations awaiting a reply (unread inbound).
  const { count: awaitingReply } = await admin
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('status', 'open')
    .gt('unread_count', 0)

  // 3 & 4. Negotiating (list 8) and demos-scheduled buckets.
  const negotiatingDeals = deals.filter(
    (d) => stageName.get(d.stage_id) === cfg.negotiatingStage,
  )
  const demoDeals = deals.filter(
    (d) => stageName.get(d.stage_id) === cfg.demoStage,
  )

  // 5. Active-stage deals whose contact has no next-follow-up date.
  const activeSet = new Set(cfg.activeStages)
  const activeDeals = deals.filter((d) =>
    activeSet.has(stageName.get(d.stage_id) ?? ''),
  )
  const withFollowUp = new Set<string>()
  const { data: followField } = await admin
    .from('custom_fields')
    .select('id')
    .eq('account_id', accountId)
    .ilike('field_name', cfg.followUpFieldName)
    .maybeSingle()
  const followFieldId = (followField as { id: string } | null)?.id
  if (followFieldId && activeDeals.length) {
    const { data: values } = await admin
      .from('contact_custom_values')
      .select('contact_id, value')
      .eq('custom_field_id', followFieldId)
      .in(
        'contact_id',
        activeDeals.map((d) => d.contact_id),
      )
    for (const v of (values ?? []) as Array<{
      contact_id: string
      value: string | null
    }>) {
      if (v.value && v.value.trim()) withFollowUp.add(v.contact_id)
    }
  }
  const noFollowUpDeals = activeDeals.filter(
    (d) => !withFollowUp.has(d.contact_id),
  )

  // 6. AI spend this month (D1 cap guard) — token estimate → USD.
  let aiUsd = 0
  const { data: usage } = await admin
    .from('ai_usage_log')
    .select('model, prompt_tokens, completion_tokens')
    .eq('account_id', accountId)
    .gte('created_at', monthStart)
  for (const u of (usage ?? []) as Array<{
    model: string
    prompt_tokens: number
    completion_tokens: number
  }>) {
    aiUsd += estimateRowCostUsd(u.model, u.prompt_tokens, u.completion_tokens)
  }

  const names = (rows: DealRow[]) => rows.map(nameOf)

  return {
    newLeadsByStage,
    awaitingReply: awaitingReply ?? 0,
    negotiating: { count: negotiatingDeals.length, names: names(negotiatingDeals) },
    demos: { count: demoDeals.length, names: names(demoDeals) },
    noFollowUp: { count: noFollowUpDeals.length, names: names(noFollowUpDeals) },
    aiSpend: {
      usd: Math.round(aiUsd * 100) / 100,
      capUsd: cfg.aiCostCapUsd,
      overCap: aiUsd >= cfg.aiCostCapUsd,
    },
    generatedAt: now.toISOString(),
  }
}

function nameList(names: string[], max: number): string {
  if (names.length === 0) return ''
  const shown = names.slice(0, max)
  const extra = names.length - shown.length
  return ` — ${shown.join(', ')}${extra > 0 ? `, +${extra} more` : ''}`
}

/**
 * Format the gathered data into the short plain-text digest. Pure and
 * side-effect-free so it is unit-testable without a database.
 */
export function buildDigestText(data: DigestData, cfg: DigestConfig): string {
  const date = data.generatedAt.slice(0, 10)
  const lines: string[] = [`📋 Dentle CRM — daily digest (${date})`, '']

  if (data.newLeadsByStage.length === 0) {
    lines.push('1. New leads (24h): none')
  } else {
    const parts = data.newLeadsByStage
      .map((s) => `${s.count} ${s.stage}`)
      .join(' · ')
    const total = data.newLeadsByStage.reduce((n, s) => n + s.count, 0)
    lines.push(`1. New leads (24h): ${total} — ${parts}`)
  }

  lines.push(`2. Threads awaiting your reply: ${data.awaitingReply}`)

  lines.push(
    `3. Post-demo negotiating (needs you): ${data.negotiating.count}` +
      nameList(data.negotiating.names, cfg.maxNames),
  )

  lines.push(
    `4. Demos scheduled: ${data.demos.count}` +
      nameList(data.demos.names, cfg.maxNames),
  )

  lines.push(
    `5. ⚠ Active leads with NO next-follow-up date: ${data.noFollowUp.count}` +
      nameList(data.noFollowUp.names, cfg.maxNames),
  )

  const spend = `$${data.aiSpend.usd.toFixed(2)} / $${data.aiSpend.capUsd} cap (est.)`
  lines.push(
    `6. AI spend this month: ${spend}${data.aiSpend.overCap ? ' — 🚨 OVER CAP' : ''}`,
  )

  return lines.join('\n')
}
