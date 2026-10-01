// ============================================================
// On/off env-var parsing, shared by the notifier's toggles.
//
// One definition of what "on" means, so NOTIFY_QUIET_HOURS and
// NOTIFY_EVERY_MESSAGE can't drift into accepting different words.
// ============================================================

const TRUTHY = new Set(['on', 'true', '1', 'yes'])
const FALSY = new Set(['off', 'false', '0', 'no'])

/**
 * Parse an on/off env var.
 *
 * Returns null when the value is absent, blank, OR unrecognised — in
 * every one of those cases the caller keeps its own default. A typo
 * must never silently flip behaviour, so callers that care log a
 * warning (use `wasProvided` to tell a typo from an absent var).
 */
export function parseBooleanFlag(raw: string | undefined): boolean | null {
  const value = raw?.trim().toLowerCase()
  if (!value) return null
  if (TRUTHY.has(value)) return true
  if (FALSY.has(value)) return false
  return null
}

/** True when the operator actually set something (even nonsense). */
export function wasProvided(raw: string | undefined): boolean {
  return Boolean(raw?.trim())
}
