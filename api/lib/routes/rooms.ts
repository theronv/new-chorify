// ─── Room item routes: /api/rooms/* ──────────────────────────────────────────
// Item-level operations on a specific room.
// Household-scoped routes (list, create) live in households.ts.
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../db'
import { requireAuth } from '../middleware'

const rooms = new Hono()

async function getRoomMeta(roomId: string): Promise<{ household_id: string } | null> {
  const result = await getDb().execute({
    sql: 'SELECT household_id FROM rooms WHERE id = ?',
    args: [roomId],
  })
  return result.rows[0] ? { household_id: result.rows[0].household_id as string } : null
}

async function getMemberId(userId: string, householdId: string): Promise<string | null> {
  const result = await getDb().execute({
    sql: 'SELECT id FROM members WHERE user_id = ? AND household_id = ?',
    args: [userId, householdId],
  })
  return (result.rows[0]?.id as string | null) ?? null
}

// ── PATCH /api/rooms/:id ──────────────────────────────────────────────────────

const UpdateRoomSchema = z.object({
  name:  z.string().min(1).max(100).trim().optional(),
  emoji: z.string().min(1).optional(),
})

rooms.patch('/:id', requireAuth, zValidator('json', UpdateRoomSchema), async (c) => {
  const roomId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const body = c.req.valid('json')
  const db = getDb()

  const meta = await getRoomMeta(roomId)
  if (!meta) return c.json({ error: 'Room not found' }, 404)
  if (!(await getMemberId(userId, meta.household_id))) return c.json({ error: 'Not authorized' }, 403)

  const sets: string[] = []
  const args: (string | number)[] = []
  if (body.name  !== undefined) { sets.push('name = ?');  args.push(body.name) }
  if (body.emoji !== undefined) { sets.push('emoji = ?'); args.push(body.emoji) }
  if (!sets.length) return c.json({ error: 'Nothing to update' }, 400)
  args.push(roomId)

  await db.execute({ sql: `UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`, args })
  const updated = await db.execute({ sql: 'SELECT * FROM rooms WHERE id = ?', args: [roomId] })
  return c.json({ room: updated.rows[0] })
})

// ── DELETE /api/rooms/:id ─────────────────────────────────────────────────────

rooms.delete('/:id', requireAuth, async (c) => {
  const roomId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const db = getDb()

  const meta = await getRoomMeta(roomId)
  if (!meta) return c.json({ error: 'Room not found' }, 404)
  if (!(await getMemberId(userId, meta.household_id))) return c.json({ error: 'Not authorized' }, 403)

  // Detach tasks so they aren't orphaned
  await db.execute({ sql: 'UPDATE tasks SET room_id = NULL WHERE room_id = ?', args: [roomId] })
  await db.execute({ sql: 'DELETE FROM rooms WHERE id = ?', args: [roomId] })
  return c.body(null, 204)
})

export default rooms
