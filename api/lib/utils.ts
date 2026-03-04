// ─── Shared utilities ─────────────────────────────────────────────────────────

/** Generates a hex UUID using Web Crypto (Edge Runtime safe). */
export function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generates a 6-character alphanumeric invite code.
 * Uses crypto.getRandomValues — not Math.random — for better entropy.
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

/**
 * Returns today's date as YYYY-MM-DD in UTC.
 * Using UTC consistently avoids the "one day off" bug that exists in the
 * original PWA's date math (which mixes local and UTC new Date() calls).
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Calculates the next due date for a recurring task.
 * Returns null for one-off tasks.
 *
 * Due dates drive recurrence: the next occurrence is always calculated from
 * the task's current due date, not from the completion date. If the task is
 * multiple periods overdue, the schedule advances by one period at a time
 * until the result is in the future (i.e. completing late never resets the
 * recurring schedule to today).
 *
 * @param recurrence  - the task's recurrence string
 * @param fromDate    - the task's current next_due (YYYY-MM-DD). Falls back
 *                      to today when null/undefined (e.g. first-time setup).
 */
export function calcNextDue(recurrence: string, fromDate?: string | null): string | null {
  if (recurrence === 'once') return null

  // Parse the base date in UTC; fall back to today if no due date is set yet.
  const base = fromDate
    ? new Date(fromDate + 'T00:00:00Z')
    : new Date(todayISO() + 'T00:00:00Z')

  function addPeriod(d: Date): Date {
    const next = new Date(d)
    switch (recurrence) {
      case 'daily':     next.setUTCDate(next.getUTCDate() + 1);         break
      case 'weekly':    next.setUTCDate(next.getUTCDate() + 7);          break
      case 'biweekly':  next.setUTCDate(next.getUTCDate() + 14);         break
      case 'monthly':   next.setUTCMonth(next.getUTCMonth() + 1);        break
      case 'quarterly': next.setUTCMonth(next.getUTCMonth() + 3);        break
      case 'biannual':  next.setUTCMonth(next.getUTCMonth() + 6);        break
      case 'annual':    next.setUTCFullYear(next.getUTCFullYear() + 1);  break
      default: {
        const m = recurrence.match(/^every_(\d+)_days$/)
        next.setUTCDate(next.getUTCDate() + (m ? parseInt(m[1], 10) : 7))
      }
    }
    return next
  }

  // Advance at least once from the original due date, then keep advancing
  // until the result is strictly in the future (handles overdue tasks).
  const today = new Date(todayISO() + 'T00:00:00Z')
  let next = addPeriod(base)
  while (next <= today) {
    next = addPeriod(next)
  }
  return next.toISOString().split('T')[0]
}
