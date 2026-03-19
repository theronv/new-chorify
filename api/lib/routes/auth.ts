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
import { clerkClient } from '../clerk'
import { Webhook } from 'svix'

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

// ── POST /api/auth/signup (legacy — kept for dual-auth period) ──────────────

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

// ── POST /api/auth/login (legacy — kept for dual-auth period) ───────────────

auth.post('/login', authRateLimit, zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  const db = getDb()

  const userResult = await db.execute({
    sql: 'SELECT id, email, password_hash FROM users WHERE email = ?',
    args: [email.toLowerCase()],
  })
  const user = userResult.rows[0]

  if (!user || !(await verifyPassword(password, user.password_hash as string))) {
    return c.json({ error: 'Incorrect email or password' }, 401)
  }

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

// ── POST /api/auth/refresh (legacy — kept for dual-auth period) ─────────────

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
    await db.execute({
      sql: 'DELETE FROM refresh_tokens WHERE user_id = ?',
      args: [stored.user_id],
    })
    return c.json({ error: 'Refresh token already used — please sign in again' }, 401)
  }

  if (new Date(stored.expires_at as string) < new Date()) {
    return c.json({ error: 'Refresh token expired' }, 401)
  }

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

auth.delete('/me', requireAuth, authRateLimit, async (c) => {
  const { sub: userId } = c.get('token')
  const clerkUserId = c.get('clerkUserId')
  const db = getDb()

  // Delete from Clerk if this is a Clerk-authenticated user
  if (clerkUserId) {
    try {
      await clerkClient.users.deleteUser(clerkUserId)
    } catch (e) {
      console.error('[auth] Failed to delete Clerk user:', e)
    }
  }

  await db.execute({
    sql: 'DELETE FROM users WHERE id = ?',
    args: [userId],
  })

  await db.execute({
    sql: 'DELETE FROM members WHERE user_id = ?',
    args: [userId],
  })

  return c.json({ ok: true })
})

// ── POST /api/auth/clerk-webhook ─────────────────────────────────────────────
// Handles Clerk webhook events (user.created, user.deleted).
// Creates/deletes the corresponding Turso user row.

auth.post('/clerk-webhook', async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    return c.json({ error: 'Webhook not configured' }, 500)
  }

  const payload = await c.req.text()
  const headers = {
    'svix-id':        c.req.header('svix-id') ?? '',
    'svix-timestamp': c.req.header('svix-timestamp') ?? '',
    'svix-signature': c.req.header('svix-signature') ?? '',
  }

  let event: any
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(payload, headers)
  } catch {
    return c.json({ error: 'Invalid webhook signature' }, 400)
  }

  const db = getDb()

  if (event.type === 'user.created') {
    const clerkUser = event.data
    const email = clerkUser.email_addresses?.[0]?.email_address
    if (!email) return c.json({ ok: true })

    // Check if user already exists (e.g. migrated user)
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ? OR clerk_id = ?',
      args: [email.toLowerCase(), clerkUser.id],
    })

    if (existing.rows.length > 0) {
      // Update clerk_id if not set
      const userId = existing.rows[0].id as string
      await db.execute({
        sql: 'UPDATE users SET clerk_id = ? WHERE id = ?',
        args: [clerkUser.id, userId],
      })
      // Fetch household/member context for publicMetadata
      const profileRow = await db.execute({
        sql: `SELECT p.household_id, m.id as member_id
              FROM profiles p
              LEFT JOIN members m ON m.user_id = p.user_id AND m.household_id = p.household_id
              WHERE p.user_id = ?`,
        args: [userId],
      })
      const householdId = (profileRow.rows[0]?.household_id as string | null) ?? undefined
      const memberId = (profileRow.rows[0]?.member_id as string | null) ?? undefined
      // Set externalId + publicMetadata on Clerk user
      try {
        await clerkClient.users.updateUser(clerkUser.id, {
          externalId: userId,
          publicMetadata: { householdId, memberId },
        })
      } catch (e) {
        console.error('[webhook] Failed to set externalId/metadata:', e)
      }
      return c.json({ ok: true })
    }

    // Create new Turso user
    const userId = generateId()
    const displayName = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(' ') || 'User'

    await db.batch([
      {
        sql: 'INSERT INTO users (id, email, password_hash, clerk_id) VALUES (?, ?, ?, ?)',
        args: [userId, email.toLowerCase(), 'clerk_managed', clerkUser.id],
      },
      {
        sql: 'INSERT INTO profiles (id, user_id, display_name) VALUES (?, ?, ?)',
        args: [generateId(), userId, displayName],
      },
    ])

    // Set externalId on Clerk user so session tokens include ext_id
    try {
      await clerkClient.users.updateUser(clerkUser.id, { externalId: userId })
    } catch (e) {
      console.error('[webhook] Failed to set externalId:', e)
    }
  }

  if (event.type === 'user.deleted') {
    const clerkUserId = event.data.id
    const user = await db.execute({
      sql: 'SELECT id FROM users WHERE clerk_id = ?',
      args: [clerkUserId],
    })
    if (user.rows[0]) {
      const userId = user.rows[0].id as string
      await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] })
      await db.execute({ sql: 'DELETE FROM members WHERE user_id = ?', args: [userId] })
    }
  }

  return c.json({ ok: true })
})

export default auth
