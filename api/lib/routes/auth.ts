// ─── Auth routes: /api/auth/* ─────────────────────────────────────────────────
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../db'
import {
  hashPassword,
  verifyPassword,
  signToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
} from '../auth'
import { generateId } from '../utils'
import { requireAuth, rateLimit } from '../middleware'

const auth = new Hono()

// Rate limit: 5 attempts per IP per 15-minute window
const authRateLimit = rateLimit(5, 15 * 60 * 1000)

// ── Schemas ───────────────────────────────────────────────────────────────────

const SignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(1).max(50).trim(),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
})

// ── POST /api/auth/signup ─────────────────────────────────────────────────────

auth.post('/signup', authRateLimit, zValidator('json', SignupSchema), async (c) => {
  const { email, password, displayName } = c.req.valid('json')
  const db = getDb()

  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email.toLowerCase()],
  })
  if (existing.rows.length > 0) {
    return c.json({ error: 'An account with this email already exists' }, 409)
  }

  const userId = generateId()
  const passwordHash = await hashPassword(password)

  await db.batch([
    {
      sql: 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      args: [userId, email.toLowerCase(), passwordHash],
    },
    {
      sql: 'INSERT INTO profiles (id, user_id, display_name) VALUES (?, ?, ?)',
      args: [generateId(), userId, displayName],
    },
  ])

  const accessToken = await signToken({ sub: userId, hid: null, mid: null })
  const refreshToken = generateRefreshToken()

  await db.execute({
    sql: 'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    args: [generateId(), userId, await hashToken(refreshToken), refreshTokenExpiry()],
  })

  return c.json(
    { accessToken, refreshToken, user: { id: userId, email: email.toLowerCase() } },
    201,
  )
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────

auth.post('/login', authRateLimit, zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  const db = getDb()

  const userResult = await db.execute({
    sql: 'SELECT id, email, password_hash FROM users WHERE email = ?',
    args: [email.toLowerCase()],
  })
  const user = userResult.rows[0]

  // Same error message for unknown email and wrong password — prevents
  // user enumeration via error message differences.
  if (!user || !(await verifyPassword(password, user.password_hash as string))) {
    return c.json({ error: 'Incorrect email or password' }, 401)
  }

  // Look up household and member from the profile
  const profileResult = await db.execute({
    sql: 'SELECT household_id FROM profiles WHERE user_id = ?',
    args: [user.id],
  })
  const householdId = (profileResult.rows[0]?.household_id as string | null) ?? null

  let memberId: string | null = null
  if (householdId) {
    const memberResult = await db.execute({
      sql: 'SELECT id FROM members WHERE user_id = ? AND household_id = ?',
      args: [user.id, householdId],
    })
    memberId = (memberResult.rows[0]?.id as string | null) ?? null
  }

  const accessToken = await signToken({ sub: user.id as string, hid: householdId, mid: memberId })
  const refreshToken = generateRefreshToken()

  await db.execute({
    sql: 'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    args: [generateId(), user.id, await hashToken(refreshToken), refreshTokenExpiry()],
  })

  return c.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email },
    householdId,
  })
})

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

auth.post('/refresh', zValidator('json', RefreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json')
  const db = getDb()
  const tokenHash = await hashToken(refreshToken)

  const stored = (
    await db.execute({
      sql: 'SELECT id, user_id, expires_at, used FROM refresh_tokens WHERE token_hash = ?',
      args: [tokenHash],
    })
  ).rows[0]

  if (!stored) {
    return c.json({ error: 'Invalid refresh token' }, 401)
  }

  if (stored.used) {
    // Token reuse detected: invalidate the entire family of tokens for this user
    // (a compromised refresh token may have already been rotated by an attacker)
    await db.execute({
      sql: 'DELETE FROM refresh_tokens WHERE user_id = ?',
      args: [stored.user_id],
    })
    return c.json({ error: 'Refresh token already used — please sign in again' }, 401)
  }

  if (new Date(stored.expires_at as string) < new Date()) {
    return c.json({ error: 'Refresh token expired' }, 401)
  }

  // Re-read household/member in case they changed since last login
  const profileResult = await db.execute({
    sql: 'SELECT household_id FROM profiles WHERE user_id = ?',
    args: [stored.user_id],
  })
  const householdId = (profileResult.rows[0]?.household_id as string | null) ?? null

  let memberId: string | null = null
  if (householdId) {
    const memberResult = await db.execute({
      sql: 'SELECT id FROM members WHERE user_id = ? AND household_id = ?',
      args: [stored.user_id, householdId],
    })
    memberId = (memberResult.rows[0]?.id as string | null) ?? null
  }

  // Rotate: mark old token used, issue new pair
  const newRefreshToken = generateRefreshToken()
  await db.batch([
    {
      sql: 'UPDATE refresh_tokens SET used = 1 WHERE id = ?',
      args: [stored.id],
    },
    {
      sql: 'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
      args: [
        generateId(),
        stored.user_id,
        await hashToken(newRefreshToken),
        refreshTokenExpiry(),
      ],
    },
  ])

  const accessToken = await signToken({
    sub: stored.user_id as string,
    hid: householdId,
    mid: memberId,
  })

  return c.json({ accessToken, refreshToken: newRefreshToken })
})

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

auth.post('/logout', requireAuth, async (c) => {
  let body: { refreshToken?: string } = {}
  try {
    body = await c.req.json()
  } catch { /* no body is fine */ }

  if (body.refreshToken) {
    const db = getDb()
    await db.execute({
      sql: 'UPDATE refresh_tokens SET used = 1 WHERE token_hash = ?',
      args: [await hashToken(body.refreshToken)],
    })
  }
  return c.json({ ok: true })
})

// ── DELETE /api/auth/me ───────────────────────────────────────────────────────
// Deletes the authenticated user's account and all associated data.
// Cascaded via DB foreign keys (profiles, refresh_tokens).
// NOTE: Household membership is removed, but households themselves are NOT deleted.

auth.delete('/me', requireAuth, authRateLimit, async (c) => {
  const { sub: userId } = c.get('token')
  const db = getDb()

  await db.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [userId],
  })

  // Note: profiles and refresh_tokens cascade.
  // members.user_id does NOT cascade in schema, so we should null it or delete it.
  // Actually, for an adult member, deleting the member record is better for privacy.
  // If the member is deleted, their completions also cascade.
  await db.execute({
    sql: 'DELETE FROM members WHERE user_id = ?',
    args: [userId],
  })

  return c.json({ ok: true })
})

export default auth
