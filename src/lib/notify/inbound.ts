// ============================================================
// Inbound-message alert — the WhatsApp webhook's one entry point into
// the notifier.
//
// Context (fork decision D6): this CRM has no inbound-message
// notification of any kind. The `notifications` table only models
// `conversation_assigned`, there is no service worker and no web push,
// and the bell only updates while a browser tab is open. That is
// invisible today because the Meta *test* number gets no real traffic,
// but the day the business number moves onto the Cloud API it becomes
// a lost-deal generator — that number stops appearing in the phone's
// WhatsApp app, so a lead's message otherwise lands in silence.
//
// ── "First unanswered message only" ─────────────────────────
//
// Five messages from one lead must produce ONE alert, and no further
// alert until the owner has replied.
//
// The signal used is the sender of the conversation's most recent
// message, read BEFORE the new inbound row is inserted:
//
//   • no prior messages          → alert (brand-new thread)
//   • prior sender is 'agent'    → alert (a human replied; this
//                                  inbound reopens the thread)
//   • prior sender is 'customer' → suppress (already unanswered)
//   • prior sender is 'bot'      → suppress (a flow / automation
//                                  auto-reply is not the owner
//                                  replying — D6 says "until the owner
//                                  has replied", and the flow is
//                                  mid-menu with the lead anyway)
//
// No new column and no new table: `messages.sender_type` already
// carries exactly this, its three values ('customer' | 'agent' |
// 'bot') already draw the human/bot line, and the read is one indexed
// lookup on `idx_messages_conversation`.
//
// `conversations.unread_count` was the other candidate and was
// rejected: it is cleared when the owner *opens* the thread in the
// inbox, not when they reply, so a thread that was read and left
// unanswered would alert again on every subsequent message — the exact
// five-alerts-per-lead behaviour this rule exists to prevent.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { formatInboundAlert } from './format'
import { conversationUrl } from './links'
import { isQuietHours, quietHoursFromEnv } from './quiet-hours'
import { sendTelegramMessage, type TelegramSendResult } from './telegram'

/**
 * Sender of the conversation's latest message, or null when the thread
 * has none yet. Call this BEFORE inserting the new inbound row.
 *
 * Returns null on a query error too — the caller then treats the
 * thread as new and alerts. Failing open is deliberate: an extra
 * notification is a nuisance, a swallowed one is a lost lead.
 */
export async function getLastMessageSenderType(
  admin: SupabaseClient,
  conversationId: string,
): Promise<'customer' | 'agent' | 'bot' | null> {
  const { data, error } = await admin
    .from('messages')
    .select('sender_type')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      '[notify/inbound] last-sender lookup failed:',
      error.message,
    )
    return null
  }
  return (data as { sender_type: 'customer' | 'agent' | 'bot' } | null)
    ?.sender_type ?? null
}

/**
 * Should this inbound message raise an alert? See the header block —
 * pure so the rule is testable without a database.
 */
export function isFirstUnansweredInbound(
  lastSenderType: 'customer' | 'agent' | 'bot' | null,
): boolean {
  return lastSenderType === null || lastSenderType === 'agent'
}

export interface NotifyInboundArgs {
  /** Sender of the previous message, from `getLastMessageSenderType`. */
  lastSenderType: 'customer' | 'agent' | 'bot' | null
  conversationId: string
  contactName: string | null
  contactPhone: string
  /** Message text, or null for media with no caption. */
  messageText: string | null
  /** The `messages.content_type` we stored for this inbound. */
  contentType: string
  /** Injectable clock, for tests. */
  now?: Date
}

export type NotifyOutcome = TelegramSendResult

/**
 * Alert the owner about a new inbound customer message.
 *
 * NEVER throws — the WhatsApp webhook awaits this inside its `after()`
 * block, and an exception here would abort the remainder of that
 * callback. Every failure is returned, and the reason is logged
 * WITHOUT the message body (customer data).
 */
export async function notifyInboundMessage(
  args: NotifyInboundArgs,
): Promise<NotifyOutcome> {
  try {
    if (!isFirstUnansweredInbound(args.lastSenderType)) {
      return { outcome: 'skipped', reason: 'conversation already unanswered' }
    }

    // Quiet hours are OFF by default (owner works nights and wants
    // every lead as it lands) — this is a single boolean check on a
    // stock deployment. When switched on via NOTIFY_QUIET_HOURS they
    // SUPPRESS rather than queue: the skipped thread is still sitting
    // unanswered in the inbox and the ~09:05 IST digest counts it.
    const now = args.now ?? new Date()
    if (isQuietHours(now, quietHoursFromEnv())) {
      return { outcome: 'skipped', reason: 'quiet hours' }
    }

    const text = formatInboundAlert({
      contactName: args.contactName,
      contactPhone: args.contactPhone,
      messageText: args.messageText,
      contentType: args.contentType,
      conversationUrl: conversationUrl(args.conversationId),
    })

    return await sendTelegramMessage(text, { parseMode: 'HTML' })
  } catch (err) {
    // Belt and braces: sendTelegramMessage already swallows its own
    // failures, so reaching here means something unexpected (a bad
    // env value, say). Still must not propagate into the webhook.
    const reason = err instanceof Error ? err.message : 'notify failed'
    console.error('[notify/inbound] alert failed:', reason)
    return { outcome: 'failed', reason }
  }
}
