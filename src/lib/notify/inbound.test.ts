import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isFirstUnansweredInbound,
  notifyEveryMessage,
  shouldAlertForInbound,
} from './inbound'
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('notifyEveryMessage', () => {
  it('is off unless explicitly set', () => {
    expect(notifyEveryMessage({})).toBe(false)
    expect(notifyEveryMessage({ NOTIFY_EVERY_MESSAGE: '' })).toBe(false)
  })

  it('accepts the on words', () => {
    for (const value of ['on', 'ON', 'true', '1', 'yes']) {
      expect(notifyEveryMessage({ NOTIFY_EVERY_MESSAGE: value })).toBe(true)
    }
  })

  it('accepts the off words', () => {
    for (const value of ['off', 'false', '0', 'no']) {
      expect(notifyEveryMessage({ NOTIFY_EVERY_MESSAGE: value })).toBe(false)
    }
  })

  it('warns and stays off for a typo rather than guessing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(notifyEveryMessage({ NOTIFY_EVERY_MESSAGE: 'enabled!' })).toBe(false)
    expect(warn).toHaveBeenCalled()
  })
})

describe('shouldAlertForInbound', () => {
  const senders = ['customer', 'agent', 'bot', null] as const

  it('keeps the de-dupe rule when the opt-out is off', () => {
    expect(shouldAlertForInbound(null, false)).toBe(true)
    expect(shouldAlertForInbound('agent', false)).toBe(true)
    expect(shouldAlertForInbound('customer', false)).toBe(false)
    expect(shouldAlertForInbound('bot', false)).toBe(false)
  })

  it('alerts on EVERY message when the opt-out is on', () => {
    // The owner's choice: a repeated buzz costs nothing, a missed
    // client message costs a deal. No sender state may suppress.
    for (const sender of senders) {
      expect(shouldAlertForInbound(sender, true)).toBe(true)
    }
  })
})
