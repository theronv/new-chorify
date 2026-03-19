// ─── Hono middleware ──────────────────────────────────────────────────────────
import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import { verifyToken, type TokenPayload } from './auth'
import { verifyToken as verifyClerkToken } from '@clerk/backend'
import { getDb } from './db'
import { clerkClient } from './clerk'

// ── Rate limiting (in-memory sliding window) ────────────────────────────────
// Resets on cold start, but still prevents brute-force within a single instance.

interface RateLimitEntry {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Evict stale entries every 5 minutes to prevent unbounded memory growth
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanupStaleEntries(windowMs: number): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  const cutoff = now - windowMs
  for (const [key, entry] of rateLimitStore) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) rateLimitStore.delete(key)
  }
}

/**
 * Returns rate-limit middleware. Keys requests by IP + path.
 * @param maxRequests  Max requests allowed in the window
 * @param windowMs     Window size in milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  return createMiddleware(async (c: Context, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown'
    const key = `${ip}:${c.req.path}`
    const now = Date.now()

    cleanupStaleEntries(windowMs)

    const entry = rateLimitStore.get(key) ?? { timestamps: [] }
    entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs)

    if (entry.timestamps.length >= maxRequests) {
      const retryAfter = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json(
        {
          error: 'Too many attempts. Try again in 15 minutes.',
          code: 'RATE_LIMITED',
        },
        429,
      )
    }

    entry.timestamps.push(now)
    rateLimitStore.set(key, entry)
    await next()
  })
}

// Extend Hono's context type map so c.get('token') is typed everywhere.
declare module 'hono' {
  interface ContextVariableMap {
    token: TokenPayload
    clerkUserId: string | null
  }
}

/**
 * Dual-auth middleware: tries Clerk JWT first, falls back to legacy jose JWT.
 * Sets c.var.token with the same { sub, hid, mid } shape regardless of source.
 * Also sets c.var.clerkUserId when the token is from Clerk (for publicMetadata updates).
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401)
  }

  const token = auth.slice(7)

  // Try Clerk JWT first
  const clerkSecretKey = process.env.CLERK_SECRET_KEY
  if (clerkSecretKey) {
    try {
      const session = await verifyClerkToken(token, { secretKey: clerkSecretKey })
      // ext_id is the Turso user_id, set via externalId on the Clerk user
      const extId = (session as any).ext_id as string | undefined
      const hid = (session as any).hid as string | null ?? null
      const mid = (session as any).mid as string | null ?? null

      if (extId) {
        c.set('token', { sub: extId, hid, mid })
        c.set('clerkUserId', session.sub)
        return next()
      }

      // Valid Clerk JWT but no ext_id — new OAuth user or webhook hasn't fired yet.
      // Look up by email in Turso and link accounts on the fly.
      const clerkUser = await clerkClient.users.getUser(session.sub)
      const email = clerkUser.emailAddresses?.[0]?.emailAddress
      if (email) {
        const db = getDb()
        const row = await db.execute({
          sql: `SELECT u.id, p.household_id, m.id as member_id
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                LEFT JOIN members m ON m.user_id = u.id AND m.household_id = p.household_id
                WHERE u.email = ?`,
          args: [email.toLowerCase()],
        })

        if (row.rows.length > 0) {
          const userId = row.rows[0].id as string
          const userHid = (row.rows[0].household_id as string | null) ?? null
          const userMid = (row.rows[0].member_id as string | null) ?? null

          // Link: set externalId + publicMetadata on Clerk, clerk_id on Turso
          try {
            await clerkClient.users.updateUser(session.sub, {
              externalId: userId,
              publicMetadata: {
                householdId: userHid ?? undefined,
                memberId: userMid ?? undefined,
              },
            })
            await db.execute({
              sql: 'UPDATE users SET clerk_id = ? WHERE id = ?',
              args: [session.sub, userId],
            })
          } catch (e) {
            console.error('[middleware] Failed to link Clerk user:', e)
          }

          c.set('token', { sub: userId, hid: userHid, mid: userMid })
          c.set('clerkUserId', session.sub)
          return next()
        }
      }
    } catch {
      // Not a valid Clerk token — try legacy
    }
  }

  // Fall back to legacy JWT
  try {
    const payload = await verifyToken(token)
    c.set('token', payload)
    c.set('clerkUserId', null)
    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
})

/**
 * Protects the cron route by checking the Authorization header against
 * the CRON_SECRET env var. Vercel automatically injects this header when
 * firing Cron Jobs; cron-job.org requires you to set it manually.
 */
export const requireCron = createMiddleware(async (c, next) => {
  const secret = process.env.CRON_SECRET
  const auth = c.req.header('Authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
})
