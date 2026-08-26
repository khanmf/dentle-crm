// ============================================================
// Notification message formatting — pure, no network, no env.
//
// Split out from ./telegram so the wording can be unit-tested without
// a fetch mock, and so D7's command replies can reuse the same
// escaping and truncation helpers.
//
// PRIVACY: everything formatted here is customer data — a lead's name,
// their phone number, and the words they typed. It leaves the system
// only to the owner's own Telegram chat (a single allow-listed chat
// id), and must never be logged in full.
// ============================================================

/**
 * Escape the three characters Telegram's HTML parse mode treats as
 * markup. Telegram's HTML flavour requires exactly `&`, `<` and `>` —
 * quotes are not special outside a tag attribute, and we never
 * interpolate into one (the conversation URL is built by us, from a
 * UUID, not from user input).
 *
 * `&` must be replaced first, or it would double-escape the entities
 * introduced by the later replacements.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Shorten to `max` characters on a whitespace boundary where one is
 * near the cut, appending an ellipsis. An alert is a nudge to go and
 * read the thread, not a transcript of it.
 */
export function truncate(value: string, max: number): string {
  const text = value.trim()
  if (text.length <= max) return text
  const clipped = text.slice(0, max)
  const lastSpace = clipped.lastIndexOf(' ')
  // Only break on a space if it isn't so early that we'd throw away
  // most of the excerpt (a single very long token has no space).
  const body = lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped
  return `${body.trimEnd()}…`
}

/** How much of the lead's message the alert carries. */
export const EXCERPT_MAX_CHARS = 300

export interface InboundAlert {
  /** Contact's display name. Falls back to the phone when unset. */
  contactName: string | null
  /** E.164-ish phone as stored on the contact row. */
  contactPhone: string
  /** The text they sent; null for media with no caption. */
  messageText: string | null
  /** `messages.content_type` — labels the alert when there's no text. */
  contentType: string
  /** Deep link into the thread, or null when the base URL is unknown. */
  conversationUrl: string | null
}

/**
 * Build the inbound-message alert as a Telegram HTML message.
 *
 * Shape (four short lines — it has to be readable in a phone's
 * notification shade without expanding it):
 *
 *   💬 New WhatsApp message
 *   Dr. Wasim · +919926728030
 *   "Do you have pricing for a 3-chair clinic?"
 *   Open in CRM →
 */
export function formatInboundAlert(alert: InboundAlert): string {
  const name = alert.contactName?.trim() || alert.contactPhone
  const lines = ['💬 <b>New WhatsApp message</b>', '']

  // Only repeat the phone when it isn't already the display name.
  const who =
    name === alert.contactPhone
      ? `<b>${escapeHtml(name)}</b>`
      : `<b>${escapeHtml(name)}</b> · ${escapeHtml(alert.contactPhone)}`
  lines.push(who)

  const excerpt = alert.messageText?.trim()
  lines.push(
    excerpt
      ? `<i>${escapeHtml(truncate(excerpt, EXCERPT_MAX_CHARS))}</i>`
      : `<i>[${escapeHtml(alert.contentType)}]</i>`,
  )

  if (alert.conversationUrl) {
    lines.push('', `<a href="${alert.conversationUrl}">Open in CRM →</a>`)
  }

  return lines.join('\n')
}
