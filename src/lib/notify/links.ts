// ============================================================
// Deep links from a notification back into the CRM.
//
// The webhook resolves these from *env only*. Unlike the invite-link
// builder in `/api/account/invitations`, there is no incoming request
// to read `X-Forwarded-Host` off: the alert is built inside the
// webhook's `after()` block, and the host on that request is Meta's
// view of us, not the operator's browser-facing origin.
//
// Kept separate from ./format because it reads the environment and so
// isn't pure. D7's `/lead <name>` reply wants the same link, hence a
// shared helper rather than an inline template string.
// ============================================================

/**
 * The CRM's public origin, or null when nothing configured tells us
 * what it is. Resolution order, first match wins:
 *
 *   1. `NEXT_PUBLIC_SITE_URL` — the var the invite-link builder
 *      already uses, so operators set one thing, not two.
 *   2. `NEXT_PUBLIC_APP_URL` — accepted as an alias; some deploy docs
 *      in this ecosystem use this name.
 *   3. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's stable production
 *      domain (preferred over VERCEL_URL, which is per-deployment and
 *      changes on every push).
 *   4. `VERCEL_URL` — last resort so a preview deploy still links
 *      somewhere real.
 */
export function getAppBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const explicit =
    env.NEXT_PUBLIC_SITE_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return stripTrailingSlash(explicit)

  const vercelHost =
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim()
  if (vercelHost) return `https://${stripTrailingSlash(vercelHost)}`

  return null
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Absolute URL that opens one conversation in the inbox. Mirrors the
 * `?c=<id>` deep-link param the inbox and the dashboard activity feed
 * already use. Null when the base URL is unknown — the alert is still
 * worth sending without a link, so callers degrade rather than skip.
 */
export function conversationUrl(
  conversationId: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const base = getAppBaseUrl(env)
  if (!base) return null
  return `${base}/inbox?c=${encodeURIComponent(conversationId)}`
}
