// ─── Hono middleware ──────────────────────────────────────────────────────────
import { createMiddleware } from 'hono/factory'
import { verifyToken, type TokenPayload } from './auth'

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
