// ─── Member routes: /api/members/* ───────────────────────────────────────────
// Item-level operations on a specific member (update push token, name, emoji).
// Household-scoped member routes (list, add child) live in households.ts.
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../db'
import { requireAuth } from '../middleware'

const members = new Hono()

// ── PATCH /api/members/:id ────────────────────────────────────────────────────
// A member can update their own record.
// A household adult can also update a child account within the same household.

const UpdateSchema = z.object({
  pushToken:   z.string().nullable().optional(),
  displayName: z.string().min(1).max(50).trim().optional(),
  emoji:       z.string().optional(),
  avatarUrl:   z.string().nullable().optional(),
}).refine(
  d => d.pushToken !== undefined || d.displayName !== undefined || d.emoji !== undefined || d.avatarUrl !== undefined,
  { message: 'At least one field must be provided' },
)

members.patch('/:id', requireAuth, zValidator('json', UpdateSchema), async (c) => {
  const memberId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const updates = c.req.valid('json')
  const db = getDb()

  if (updates.avatarUrl && updates.avatarUrl.length > 100_000) {
    return c.json(
      { error: 'Avatar too large. Max 75KB.', code: 'AVATAR_TOO_LARGE' },
      400,
    )
  }

  const memberResult = await db.execute({
    sql: 'SELECT id, household_id, user_id FROM members WHERE id = ?',
    args: [memberId],
  })
  const member = memberResult.rows[0]
  if (!member) return c.json({ error: 'Member not found' }, 404)

  // Authorization: must be own record OR an adult member of the same household
  const isOwn = member.user_id === userId
  if (!isOwn) {
    const householdCheck = await db.execute({
      sql: 'SELECT id FROM members WHERE user_id = ? AND household_id = ?',
      args: [userId, member.household_id],
    })
    if (!householdCheck.rows.length) {
      return c.json({ error: 'Not authorized to update this member' }, 403)
    }
  }

  // Build SET clause from only the provided fields
  const setClauses: string[] = []
  const args: (string | null)[] = []
  if (updates.pushToken !== undefined)   { setClauses.push('push_token = ?');  args.push(updates.pushToken) }
  if (updates.displayName !== undefined) { setClauses.push('display_name = ?'); args.push(updates.displayName) }
  if (updates.emoji !== undefined)       { setClauses.push('emoji = ?');        args.push(updates.emoji) }
  if (updates.avatarUrl !== undefined)   { setClauses.push('avatar_url = ?');   args.push(updates.avatarUrl) }
  args.push(memberId)

  await db.execute({
    sql: `UPDATE members SET ${setClauses.join(', ')} WHERE id = ?`,
    args,
  })

  return c.json({ ok: true })
})

export default members
