// ─── Hono middleware ──────────────────────────────────────────────────────────
import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import { verifyToken, type TokenPayload } from './auth'

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
  }
}

/**
 * Validates the Bearer JWT in the Authorization header.
 * Sets c.var.token on success; returns 401 on failure.
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401)
  }
  try {
    const payload = await verifyToken(auth.slice(7))
    c.set('token', payload)
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
