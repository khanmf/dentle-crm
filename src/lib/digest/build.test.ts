import { describe, it, expect } from 'vitest'
import { buildDigestText, DEFAULT_DIGEST_CONFIG, type DigestData } from './build'

const base: DigestData = {
  newLeadsByStage: [],
  awaitingReply: 0,
  negotiating: { count: 0, names: [] },
  demos: { count: 0, names: [] },
  noFollowUp: { count: 0, names: [] },
  aiSpend: { usd: 0, capUsd: 15, overCap: false },
  generatedAt: '2026-07-22T04:00:00.000Z',
}

describe('buildDigestText', () => {
  it('renders the empty-day digest with all six lines', () => {
    const out = buildDigestText(base, DEFAULT_DIGEST_CONFIG)
    expect(out).toContain('daily digest (2026-07-22)')
    expect(out).toContain('1. New leads (24h): none')
    expect(out).toContain('2. Threads awaiting your reply: 0')
    expect(out).toContain('3. Post-demo negotiating (needs you): 0')
    expect(out).toContain('4. Demos scheduled: 0')
    expect(out).toContain('5. ⚠ Active leads with NO next-follow-up date: 0')
    expect(out).toContain('6. AI spend this month: $0.00 / $15 cap')
  })

  it('summarises new leads by stage with a total', () => {
    const out = buildDigestText(
      {
        ...base,
        newLeadsByStage: [
          { stage: 'Fresh inquiry', count: 3 },
          { stage: 'Talks started', count: 1 },
        ],
      },
      DEFAULT_DIGEST_CONFIG,
    )
    expect(out).toContain('1. New leads (24h): 4 — 3 Fresh inquiry · 1 Talks started')
  })

  it('lists names and collapses the overflow to "+N more"', () => {
    const out = buildDigestText(
      {
        ...base,
        noFollowUp: {
          count: 7,
          names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        },
      },
      DEFAULT_DIGEST_CONFIG,
    )
    expect(out).toContain(
      '5. ⚠ Active leads with NO next-follow-up date: 7 — A, B, C, D, E, +2 more',
    )
  })

  it('flags an over-cap month loudly', () => {
    const out = buildDigestText(
      { ...base, aiSpend: { usd: 16.4, capUsd: 15, overCap: true } },
      DEFAULT_DIGEST_CONFIG,
    )
    expect(out).toContain('6. AI spend this month: $16.40 / $15 cap (est.) — 🚨 OVER CAP')
  })
})
