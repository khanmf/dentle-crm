// ============================================================
// Telegram transport — the CRM's notification channel (fork decision
// D6, DENTLE_FORK_NOTES.md).
//
// Why Telegram and not WhatsApp-to-self: an alert sent over WhatsApp
// inherits both of WhatsApp's defects — a per-message cost and the
// 24-hour customer-service window, which would make alerts silently
// undeliverable unless the owner had messaged himself recently. The
// Bot API has no message charge and no window concept.
//
// This module is deliberately transport-only and knows nothing about
// webhooks, conversations or digests. D7 (stage 1) adds a *receive*
// endpoint for `/today`, `/pending`, `/lead <name>` and `/digest`; it
// will reuse `sendTelegramMessage` verbatim for its replies, so nothing
// conversation-shaped belongs in here.
//
// Two invariants everything else depends on:
//
//   1. **It never throws.** A Telegram outage must not break the
//      WhatsApp webhook (a lead's message would be lost) or the digest
//      cron (it would return 500 and go red). Every failure path
//      returns a result object.
//   2. **It never leaks the bot token.** The token sits in the request
//      URL — Telegram's own API shape — so anything we log is passed
//      through `redactToken` first. A leaked token lets anyone post to
//      the owner's chat.
// ============================================================

export interface TelegramConfig {
  botToken: string
  chatId: string
}

/**
 * Read the bot credentials from the environment. Returns null when
 * either is absent, which is the normal state in local dev and CI —
 * callers treat that as "notifications are off", not as an error.
 *
 * `env` is injectable so the pure paths stay unit-testable without
 * mutating `process.env`.
 */
export function getTelegramConfig(
  env: Record<string, string | undefined> = process.env,
): TelegramConfig | null {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = env.TELEGRAM_CHAT_ID?.trim()
  if (!botToken || !chatId) return null
  return { botToken, chatId }
}

/**
 * Strip the bot token out of any string before it reaches a log line.
 * `fetch` failures can quote the request URL (which embeds the token),
 * and so can a proxy's error body — neither is under our control, so we
 * scrub on the way out rather than trusting the source.
 */
export function redactToken(text: string, botToken: string): string {
  if (!botToken) return text
  return text.split(botToken).join('<redacted>')
}

export type TelegramOutcome = 'sent' | 'skipped' | 'failed'

export interface TelegramSendResult {
  outcome: TelegramOutcome
  /** Why it was skipped or how it failed. Token-redacted, safe to log. */
  reason?: string
}

export interface SendTelegramOptions {
  /**
   * Override the env-derived credentials. Used by tests; production
   * callers leave this unset.
   */
  config?: TelegramConfig
  /**
   * Telegram's `parse_mode`. Omit for plain text (the digest — its
   * contact names are unescaped and must not be parsed as markup).
   * Pass 'HTML' for the inbound alert, which carries a link; the
   * caller is then responsible for escaping the interpolated values
   * (see `escapeHtml` in ./format).
   */
  parseMode?: 'HTML' | 'MarkdownV2'
  /** Suppress the link preview card. Defaults to true. */
  disablePreview?: boolean
  /** Request timeout in ms. Defaults to 5000. */
  timeoutMs?: number
}

/**
 * Telegram's documented message ceiling. Longer bodies are rejected
 * with a 400, so we truncate rather than lose the whole notification.
 */
const TELEGRAM_MAX_MESSAGE_CHARS = 4096

/**
 * Post one message to the owner's Telegram chat.
 *
 * NEVER throws and NEVER rejects — the return value is the only channel
 * for failure. A missing config is `skipped` (not `failed`), so local
 * dev and CI don't log noise about something that isn't broken.
 */
export async function sendTelegramMessage(
  text: string,
  options: SendTelegramOptions = {},
): Promise<TelegramSendResult> {
  const config = options.config ?? getTelegramConfig()
  if (!config) {
    return { outcome: 'skipped', reason: 'telegram not configured' }
  }

  const body = text.trim()
  if (!body) return { outcome: 'skipped', reason: 'empty message' }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: body.slice(0, TELEGRAM_MAX_MESSAGE_CHARS),
          ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
          disable_web_page_preview: options.disablePreview ?? true,
        }),
        // Bound the wait. The inbound-message caller runs inside the
        // webhook's `after()` block, which shares the route's
        // maxDuration with real lead-facing work — a hung notification
        // must not eat that budget.
        signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
      },
    )

    if (!response.ok) {
      // Telegram returns its own JSON error body (`description`);
      // fall back to the status line when the body isn't readable.
      const detail = await response.text().catch(() => '')
      const reason = redactToken(
        `telegram ${response.status}: ${detail.slice(0, 300)}`,
        config.botToken,
      )
      console.error('[notify/telegram] send failed:', reason)
      return { outcome: 'failed', reason }
    }

    return { outcome: 'sent' }
  } catch (err) {
    const reason = redactToken(
      err instanceof Error ? err.message : 'send failed',
      config.botToken,
    )
    console.error('[notify/telegram] send failed:', reason)
    return { outcome: 'failed', reason }
  }
}
