import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  DEFAULT_QUIET_HOURS,
  isQuietHours,
  minutesOfDayInZone,
  parseTimeOfDay,
  quietHoursFromEnv,
} from './quiet-hours'

/** IST is UTC+5:30 — a given IST wall-clock time as a UTC instant. */
function ist(hour: number, minute = 0): Date {
  const utcMinutes = hour * 60 + minute - (5 * 60 + 30)
  return new Date(Date.UTC(2026, 7, 15, 0, utcMinutes))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseTimeOfDay', () => {
  it('parses HH:MM and bare HH', () => {
    expect(parseTimeOfDay('22:00')).toBe(22 * 60)
    expect(parseTimeOfDay('08:30')).toBe(8 * 60 + 30)
    expect(parseTimeOfDay('7')).toBe(7 * 60)
    expect(parseTimeOfDay(' 23:59 ')).toBe(23 * 60 + 59)
    expect(parseTimeOfDay('00:00')).toBe(0)
  })

  it('rejects out-of-range and malformed values', () => {
    expect(parseTimeOfDay('24:00')).toBeNull()
    expect(parseTimeOfDay('22:60')).toBeNull()
    expect(parseTimeOfDay('22:5')).toBeNull()
    expect(parseTimeOfDay('quarter past')).toBeNull()
    expect(parseTimeOfDay('')).toBeNull()
  })
})

describe('minutesOfDayInZone', () => {
  it('reads the wall clock in the target zone, not UTC', () => {
    // 18:30 UTC is 00:00 IST the next day.
    const instant = new Date(Date.UTC(2026, 7, 15, 18, 30))
    expect(minutesOfDayInZone(instant, 'Asia/Kolkata')).toBe(0)
    expect(minutesOfDayInZone(instant, 'UTC')).toBe(18 * 60 + 30)
  })
})

// Suppression is off by default now, so every behaviour test below
// opts in explicitly — which is also what a user who wants quiet
// hours has to do.
const ENABLED = { ...DEFAULT_QUIET_HOURS, enabled: true }

describe('isQuietHours — overnight window (22:00–08:00 IST), opted in', () => {
  const cfg = ENABLED

  it('suppresses through the night', () => {
    expect(isQuietHours(ist(22, 0), cfg)).toBe(true) // boundary: inclusive
    expect(isQuietHours(ist(23, 30), cfg)).toBe(true)
    expect(isQuietHours(ist(0, 15), cfg)).toBe(true) // past midnight
    expect(isQuietHours(ist(3, 0), cfg)).toBe(true)
    expect(isQuietHours(ist(7, 59), cfg)).toBe(true)
  })

  it('lets daytime messages through', () => {
    expect(isQuietHours(ist(8, 0), cfg)).toBe(false) // boundary: exclusive
    expect(isQuietHours(ist(9, 5), cfg)).toBe(false) // digest o'clock
    expect(isQuietHours(ist(14, 0), cfg)).toBe(false)
    expect(isQuietHours(ist(21, 59), cfg)).toBe(false)
  })

  it('is disabled wholesale when enabled is false', () => {
    expect(isQuietHours(ist(3, 0), { ...cfg, enabled: false })).toBe(false)
  })
})

describe('isQuietHours — edge cases', () => {
  it('handles a same-day window that does not wrap midnight', () => {
    const cfg = { ...ENABLED, startMinute: 13 * 60, endMinute: 14 * 60 }
    expect(isQuietHours(ist(12, 59), cfg)).toBe(false)
    expect(isQuietHours(ist(13, 0), cfg)).toBe(true)
    expect(isQuietHours(ist(13, 59), cfg)).toBe(true)
    expect(isQuietHours(ist(14, 0), cfg)).toBe(false)
    expect(isQuietHours(ist(3, 0), cfg)).toBe(false)
  })

  it('treats start === end as an empty window, never a 24h one', () => {
    const cfg = { ...ENABLED, startMinute: 60, endMinute: 60 }
    expect(isQuietHours(ist(1, 0), cfg)).toBe(false)
    expect(isQuietHours(ist(13, 0), cfg)).toBe(false)
  })

  it('fails open when the timezone cannot be resolved', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cfg = { ...ENABLED, timeZone: 'Mars/Olympus_Mons' }
    // 3am IST would normally be suppressed; an unusable zone must not
    // silently swallow every alert instead.
    expect(isQuietHours(ist(3, 0), cfg)).toBe(false)
  })

  it('respects a non-IST zone', () => {
    const cfg = { ...ENABLED, timeZone: 'UTC' }
    // 23:00 IST is 17:30 UTC — quiet in IST, awake in UTC.
    expect(isQuietHours(ist(23, 0), cfg)).toBe(false)
  })
})

describe('quietHoursFromEnv', () => {
  it('is OFF by default — alerts fire 24/7 on a stock deployment', () => {
    const cfg = quietHoursFromEnv({})
    expect(cfg.enabled).toBe(false)
    expect(cfg).toEqual(DEFAULT_QUIET_HOURS)
    // And that default genuinely lets a 3am message through.
    expect(isQuietHours(ist(3, 0), cfg)).toBe(false)
  })

  it('turns on with the explicit toggle, keeping the 22:00–08:00 default window', () => {
    for (const value of ['on', 'ON', 'true', '1', 'yes']) {
      const cfg = quietHoursFromEnv({ NOTIFY_QUIET_HOURS: value })
      expect(cfg.enabled).toBe(true)
      expect(isQuietHours(ist(3, 0), cfg)).toBe(true)
      expect(isQuietHours(ist(14, 0), cfg)).toBe(false)
    }
  })

  it('stays off for the explicit falsy values', () => {
    for (const value of ['off', 'OFF', 'false', '0', 'no']) {
      expect(quietHoursFromEnv({ NOTIFY_QUIET_HOURS: value }).enabled).toBe(
        false,
      )
    }
  })

  it('setting a window implies you want one, without the toggle', () => {
    expect(
      quietHoursFromEnv({ NOTIFY_QUIET_HOURS_START: '23:00' }).enabled,
    ).toBe(true)
    expect(quietHoursFromEnv({ NOTIFY_QUIET_HOURS_END: '06:00' }).enabled).toBe(
      true,
    )
  })

  it('an explicit off overrides an implied on', () => {
    const cfg = quietHoursFromEnv({
      NOTIFY_QUIET_HOURS: 'off',
      NOTIFY_QUIET_HOURS_START: '23:00',
      NOTIFY_QUIET_HOURS_END: '06:00',
    })
    expect(cfg.enabled).toBe(false)
    // The window is still remembered, just inert.
    expect(cfg.startMinute).toBe(23 * 60)
  })

  it('accepts a full override', () => {
    expect(
      quietHoursFromEnv({
        NOTIFY_QUIET_HOURS: 'on',
        NOTIFY_QUIET_HOURS_START: '21:30',
        NOTIFY_QUIET_HOURS_END: '07:00',
        NOTIFY_TIMEZONE: 'UTC',
      }),
    ).toEqual({
      enabled: true,
      startMinute: 21 * 60 + 30,
      endMinute: 7 * 60,
      timeZone: 'UTC',
    })
  })

  it('falls back to defaults for malformed values instead of throwing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      quietHoursFromEnv({
        NOTIFY_QUIET_HOURS_START: '25:00',
        NOTIFY_QUIET_HOURS_END: 'morning',
        NOTIFY_TIMEZONE: 'Not/AZone',
      }),
    ).toEqual(DEFAULT_QUIET_HOURS)
    // A junk toggle leaves the default (off) alone rather than guessing.
    expect(
      quietHoursFromEnv({ NOTIFY_QUIET_HOURS: 'maybe' }).enabled,
    ).toBe(false)
  })
})
