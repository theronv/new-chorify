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
 * All arithmetic is in UTC to match todayISO().
 */
export function calcNextDue(recurrence: string): string | null {
  const d = new Date()
  switch (recurrence) {
    case 'daily':     d.setUTCDate(d.getUTCDate() + 1);          break
    case 'weekly':    d.setUTCDate(d.getUTCDate() + 7);           break
    case 'biweekly':  d.setUTCDate(d.getUTCDate() + 14);          break
    case 'monthly':   d.setUTCMonth(d.getUTCMonth() + 1);         break
    case 'quarterly': d.setUTCMonth(d.getUTCMonth() + 3);         break
    case 'biannual':  d.setUTCMonth(d.getUTCMonth() + 6);         break
    case 'annual':    d.setUTCFullYear(d.getUTCFullYear() + 1);   break
    case 'once':      return null
    default:          d.setUTCDate(d.getUTCDate() + 7)
  }
  return d.toISOString().split('T')[0]
}
