import { describe, it, expect } from 'vitest'
import { isFirstUnansweredInbound } from './inbound'
import { conversationUrl, getAppBaseUrl } from './links'
import { getTelegramConfig, redactToken } from './telegram'

describe('isFirstUnansweredInbound', () => {
  it('alerts on a brand-new thread (no prior message)', () => {
    expect(isFirstUnansweredInbound(null)).toBe(true)
  })

  it('alerts when a human agent replied last', () => {
    expect(isFirstUnansweredInbound('agent')).toBe(true)
  })

  it('stays silent while the thread is already unanswered', () => {
    // The five-messages-from-one-lead case: only the first gets through.
    expect(isFirstUnansweredInbound('customer')).toBe(false)
  })

  it('stays silent after a flow / automation auto-reply', () => {
    // D6: "until the owner has replied" — a bot is not the owner, and
    // the flow is mid-menu with the lead anyway.
    expect(isFirstUnansweredInbound('bot')).toBe(false)
  })
})

describe('getAppBaseUrl', () => {
  it('prefers NEXT_PUBLIC_SITE_URL and strips trailing slashes', () => {
    expect(getAppBaseUrl({ NEXT_PUBLIC_SITE_URL: 'https://crm.example//' })).toBe(
      'https://crm.example',
    )
  })

  it('accepts NEXT_PUBLIC_APP_URL as an alias', () => {
    expect(getAppBaseUrl({ NEXT_PUBLIC_APP_URL: 'https://crm.example' })).toBe(
      'https://crm.example',
    )
  })

  it('falls back to Vercel’s stable production domain before the per-deploy one', () => {
    expect(
      getAppBaseUrl({
        VERCEL_PROJECT_PRODUCTION_URL: 'crm.vercel.app',
        VERCEL_URL: 'crm-abc123.vercel.app',
      }),
    ).toBe('https://crm.vercel.app')
    expect(getAppBaseUrl({ VERCEL_URL: 'crm-abc123.vercel.app' })).toBe(
      'https://crm-abc123.vercel.app',
    )
  })

  it('returns null when nothing is configured', () => {
    expect(getAppBaseUrl({})).toBeNull()
  })
})

describe('conversationUrl', () => {
  it('builds the inbox deep link', () => {
    expect(
      conversationUrl('abc-123', { NEXT_PUBLIC_SITE_URL: 'https://crm.example' }),
    ).toBe('https://crm.example/inbox?c=abc-123')
  })

  it('returns null when the base URL is unknown', () => {
    expect(conversationUrl('abc-123', {})).toBeNull()
  })
})

describe('getTelegramConfig', () => {
  it('returns null unless both vars are present and non-blank', () => {
    expect(getTelegramConfig({})).toBeNull()
    expect(getTelegramConfig({ TELEGRAM_BOT_TOKEN: 't' })).toBeNull()
    expect(getTelegramConfig({ TELEGRAM_CHAT_ID: '1' })).toBeNull()
    expect(
      getTelegramConfig({ TELEGRAM_BOT_TOKEN: '  ', TELEGRAM_CHAT_ID: '1' }),
    ).toBeNull()
  })

  it('trims both values', () => {
    expect(
      getTelegramConfig({
        TELEGRAM_BOT_TOKEN: ' 123:abc ',
        TELEGRAM_CHAT_ID: ' 456 ',
      }),
    ).toEqual({ botToken: '123:abc', chatId: '456' })
  })
})

describe('redactToken', () => {
  it('scrubs the token out of anything bound for a log line', () => {
    const token = '123456:AAquitesecret'
    const raw = `request to https://api.telegram.org/bot${token}/sendMessage failed`
    const safe = redactToken(raw, token)
    expect(safe).not.toContain(token)
    expect(safe).toContain('<redacted>')
  })

  it('scrubs every occurrence', () => {
    const token = 'abc'
    expect(redactToken('abc and abc', token)).toBe(
      '<redacted> and <redacted>',
    )
  })
})
