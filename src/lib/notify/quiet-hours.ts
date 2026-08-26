// ============================================================
// Quiet hours for owner notifications — OFF by default.
//
// Owner decision (2026-08-26): alerts fire 24/7. He works nights and
// wants every lead the moment it lands; a suppression window would
// cost him messages he'd rather have. So the default is "never
// suppress", and quiet hours are strictly opt-in.
//
// The machinery is kept, not deleted, because the reasoning that
// produced it still holds if the situation changes: an alert that
// wakes someone at 3am eventually gets muted, and a muted channel is
// worse than no channel. Turning it on is one env var (see
// `quietHoursFromEnv`) — no code change, no redeploy of logic.
//
// When it IS on the rule is SUPPRESS, not queue: a skipped overnight
// alert costs little, because the thread is still sitting unanswered
// in the inbox and the ~09:05 IST digest counts it.
//
// Everything here is pure: `isQuietHours` takes the clock as an
// argument so it can be unit-tested across the wrap-around boundary
// without touching the system time.
// ============================================================

export interface QuietHoursConfig {
  /** When false, nothing is ever suppressed. Defaults to false. */
  enabled: boolean
  /** Start of the quiet window, minutes since local midnight. */
  startMinute: number
  /** End of the quiet window, minutes since local midnight (exclusive). */
  endMinute: number
  /** IANA zone the two boundaries are expressed in. */
  timeZone: string
}

/**
 * Disabled, with 22:00–08:00 IST held as the window that WOULD apply
 * if the owner ever switches it on. The times are the owner's
 * timezone (Bhopal); they are inert while `enabled` is false.
 */
export const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: false,
  startMinute: 22 * 60,
  endMinute: 8 * 60,
  timeZone: 'Asia/Kolkata',
}

/**
 * Parse an `HH:MM` (or `HH`) time-of-day into minutes since midnight.
 * Returns null for anything malformed or out of range, so the caller
 * can fall back to the default rather than silently shifting the
 * window to some nonsense hour.
 */
export function parseTimeOfDay(raw: string): number | null {
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(raw.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** True when the string names a zone this runtime can actually resolve. */
function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

const TRUTHY = new Set(['on', 'true', '1', 'yes'])
const FALSY = new Set(['off', 'false', '0', 'no'])

/**
 * Build the quiet-hours config from env. Suppression is OFF unless
 * something in the environment asks for it:
 *
 *   NOTIFY_QUIET_HOURS       'on' enables it, 'off' disables it.
 *                            Explicit either way, and always wins.
 *   NOTIFY_QUIET_HOURS_START 'HH:MM', default '22:00'
 *   NOTIFY_QUIET_HOURS_END   'HH:MM', default '08:00'
 *   NOTIFY_TIMEZONE          IANA zone, default 'Asia/Kolkata'
 *
 * Setting a START or END without the toggle also switches it on —
 * bothering to define a window is a clear statement that you want
 * one, and having to set two vars to get one behaviour is a foot-gun.
 * An explicit `NOTIFY_QUIET_HOURS=off` still overrides that.
 *
 * A malformed value warns rather than throws — a typo in an env var
 * must not take the notifier down.
 */
export function quietHoursFromEnv(
  env: Record<string, string | undefined> = process.env,
): QuietHoursConfig {
  const cfg = { ...DEFAULT_QUIET_HOURS }

  const rawStart = env.NOTIFY_QUIET_HOURS_START?.trim()
  if (rawStart) {
    const parsed = parseTimeOfDay(rawStart)
    if (parsed === null) {
      console.warn(
        '[notify/quiet-hours] ignoring malformed NOTIFY_QUIET_HOURS_START',
      )
    } else {
      cfg.startMinute = parsed
      cfg.enabled = true
    }
  }

  const rawEnd = env.NOTIFY_QUIET_HOURS_END?.trim()
  if (rawEnd) {
    const parsed = parseTimeOfDay(rawEnd)
    if (parsed === null) {
      console.warn(
        '[notify/quiet-hours] ignoring malformed NOTIFY_QUIET_HOURS_END',
      )
    } else {
      cfg.endMinute = parsed
      cfg.enabled = true
    }
  }

  const rawZone = env.NOTIFY_TIMEZONE?.trim()
  if (rawZone) {
    if (isValidTimeZone(rawZone)) {
      cfg.timeZone = rawZone
    } else {
      console.warn('[notify/quiet-hours] ignoring unknown NOTIFY_TIMEZONE')
    }
  }

  // The explicit toggle is read LAST so it beats the implicit enable
  // above in both directions.
  const toggle = env.NOTIFY_QUIET_HOURS?.trim().toLowerCase()
  if (toggle) {
    if (TRUTHY.has(toggle)) {
      cfg.enabled = true
    } else if (FALSY.has(toggle)) {
      cfg.enabled = false
    } else {
      console.warn('[notify/quiet-hours] ignoring unrecognised NOTIFY_QUIET_HOURS')
    }
  }

  return cfg
}

/**
 * Minutes since midnight for `now`, as read in `timeZone`. Throws for
 * an unresolvable zone — `isQuietHours` is the guard that catches it.
 */
export function minutesOfDayInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  return value('hour') * 60 + value('minute')
}

/**
 * Is `now` inside the quiet window?
 *
 * Returns false immediately when suppression is disabled, which is the
 * default — so on a stock deployment this is a single boolean check
 * and every alert goes straight through.
 *
 * When enabled, handles the overnight wrap (22:00 → 08:00 spans
 * midnight) as well as a same-day window (e.g. 13:00 → 14:00).
 * `start === end` is treated as an empty window, not a 24-hour one —
 * the safer reading of what an operator who set both to the same value
 * meant, since the alternative silently mutes every alert forever.
 *
 * Fails OPEN: if the zone can't be resolved at call time we return
 * false and let the notification through. The problem this whole
 * feature exists to solve is missed leads, so a stray late-night buzz
 * from a misconfigured zone is the cheaper error.
 */
export function isQuietHours(now: Date, cfg: QuietHoursConfig): boolean {
  if (!cfg.enabled) return false
  if (cfg.startMinute === cfg.endMinute) return false

  let minute: number
  try {
    minute = minutesOfDayInZone(now, cfg.timeZone)
  } catch {
    console.warn(
      '[notify/quiet-hours] could not resolve timezone; not suppressing',
    )
    return false
  }

  if (cfg.startMinute < cfg.endMinute) {
    // Same-day window: [start, end)
    return minute >= cfg.startMinute && minute < cfg.endMinute
  }
  // Overnight window: [start, midnight) ∪ [midnight, end)
  return minute >= cfg.startMinute || minute < cfg.endMinute
}
