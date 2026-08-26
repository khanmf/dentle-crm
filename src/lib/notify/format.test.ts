import { describe, it, expect } from 'vitest'
import {
  EXCERPT_MAX_CHARS,
  escapeHtml,
  formatInboundAlert,
  truncate,
} from './format'

const base = {
  contactName: 'Dr. Wasim',
  contactPhone: '+919926728030',
  messageText: 'Do you have pricing for a 3-chair clinic?',
  contentType: 'text',
  conversationUrl: 'https://crm.example/inbox?c=abc-123',
}

describe('escapeHtml', () => {
  it('escapes the three characters Telegram HTML treats as markup', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d')
  })

  it('escapes & first so entities are not double-escaped', () => {
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;')
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('leaves ordinary text alone', () => {
    expect(escapeHtml("Dr. O'Brien — 50% off?")).toBe("Dr. O'Brien — 50% off?")
  })
})

describe('truncate', () => {
  it('returns short text untouched (trimmed)', () => {
    expect(truncate('  hello  ', 20)).toBe('hello')
  })

  it('cuts on a word boundary when there is one near the limit', () => {
    expect(truncate('the quick brown fox jumps', 16)).toBe('the quick brown…')
  })

  it('hard-cuts a single long token rather than returning almost nothing', () => {
    const result = truncate(`short ${'x'.repeat(50)}`, 20)
    expect(result).toHaveLength(21) // 20 chars + ellipsis
    expect(result.endsWith('…')).toBe(true)
  })

  it('does not append an ellipsis at exactly the limit', () => {
    expect(truncate('abcde', 5)).toBe('abcde')
  })
})

describe('formatInboundAlert', () => {
  it('carries the name, the phone, an excerpt and the deep link', () => {
    const text = formatInboundAlert(base)
    expect(text).toContain('New WhatsApp message')
    expect(text).toContain('<b>Dr. Wasim</b>')
    expect(text).toContain('+919926728030')
    expect(text).toContain('Do you have pricing for a 3-chair clinic?')
    expect(text).toContain(
      '<a href="https://crm.example/inbox?c=abc-123">Open in CRM →</a>',
    )
  })

  it('escapes a contact name that contains markup characters', () => {
    const text = formatInboundAlert({
      ...base,
      contactName: 'Bold <b>Dentals</b> & Co',
    })
    expect(text).toContain('<b>Bold &lt;b&gt;Dentals&lt;/b&gt; &amp; Co</b>')
    // The only real tags are the ones we added ourselves.
    expect(text).not.toContain('<b>Dentals')
  })

  it('escapes markup characters in the message body', () => {
    const text = formatInboundAlert({
      ...base,
      messageText: 'is 5 < 10 & <script>alert(1)</script>?',
    })
    expect(text).toContain('5 &lt; 10 &amp;')
    expect(text).not.toContain('<script>')
  })

  it('falls back to the phone when the contact has no name', () => {
    const text = formatInboundAlert({ ...base, contactName: null })
    expect(text).toContain('<b>+919926728030</b>')
    // Not repeated as "phone · phone".
    expect(text.match(/\+919926728030/g)).toHaveLength(1)
  })

  it('does not repeat the phone when it is also the display name', () => {
    const text = formatInboundAlert({
      ...base,
      contactName: '+919926728030',
    })
    expect(text.match(/\+919926728030/g)).toHaveLength(1)
  })

  it('labels media that arrived without a caption', () => {
    const text = formatInboundAlert({
      ...base,
      messageText: null,
      contentType: 'image',
    })
    expect(text).toContain('<i>[image]</i>')
  })

  it('treats a whitespace-only body as no text', () => {
    const text = formatInboundAlert({
      ...base,
      messageText: '   \n ',
      contentType: 'audio',
    })
    expect(text).toContain('<i>[audio]</i>')
  })

  it('truncates a very long message', () => {
    const text = formatInboundAlert({
      ...base,
      messageText: 'word '.repeat(400),
    })
    expect(text).toContain('…')
    expect(text.length).toBeLessThan(EXCERPT_MAX_CHARS + 200)
  })

  it('omits the link line when no base URL is configured', () => {
    const text = formatInboundAlert({ ...base, conversationUrl: null })
    expect(text).not.toContain('Open in CRM')
    expect(text).toContain('Dr. Wasim')
  })

  it('stays well inside Telegram’s 4096-char message ceiling', () => {
    const text = formatInboundAlert({
      ...base,
      contactName: 'x'.repeat(500),
      messageText: 'y'.repeat(5000),
    })
    expect(text.length).toBeLessThan(4096)
  })
})
