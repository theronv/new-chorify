// ─── Task item routes: /api/tasks/* ──────────────────────────────────────────
// Item-level operations on a specific task.
// Household-scoped task routes (list, create) live in households.ts.
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../db'
import { generateId, calcNextDue, todayISO } from '../utils'
import { requireAuth } from '../middleware'

const tasks = new Hono()

/** Returns the caller's memberId in this household, or null. */
async function getMemberId(userId: string, householdId: string): Promise<string | null> {
  const result = await getDb().execute({
    sql: 'SELECT id FROM members WHERE user_id = ? AND household_id = ?',
    args: [userId, householdId],
  })
  return (result.rows[0]?.id as string | null) ?? null
}

// ── PATCH /api/tasks/:id ──────────────────────────────────────────────────────

const RECURRENCES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'biannual', 'annual', 'once'] as const
const recurrenceSchema = z.string().refine(
  v => (RECURRENCES as readonly string[]).includes(v) || /^every_\d+_days$/.test(v),
  { message: 'Invalid recurrence' },
)

const UpdateTaskSchema = z.object({
  title:      z.string().min(1).max(100).trim().optional(),
  category:   z.string().min(1).max(100).optional(),
  recurrence: recurrenceSchema.optional(),
  assignedTo: z.string().nullable().optional(),
  roomId:     z.string().nullable().optional(),
  nextDue:    z.string().nullable().optional(), // YYYY-MM-DD or null
  notes:      z.string().max(500).nullable().optional(),
  isPrivate:  z.boolean().optional(),
})

tasks.patch('/:id', requireAuth, zValidator('json', UpdateTaskSchema), async (c) => {
  const taskId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const body = c.req.valid('json')
  const db = getDb()

  const taskResult = await db.execute({
    sql: 'SELECT household_id FROM tasks WHERE id = ?',
    args: [taskId],
  })
  const task = taskResult.rows[0]
  if (!task) return c.json({ error: 'Task not found' }, 404)

  if (!(await getMemberId(userId, task.household_id as string))) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  // Build SET clause — only include fields that were explicitly sent
  const sets: string[] = []
  const args: (string | number | null)[] = []

  if (body.title      !== undefined) { sets.push('title = ?');       args.push(body.title) }
  if (body.category   !== undefined) { sets.push('category = ?');    args.push(body.category) }
  if (body.recurrence !== undefined) { sets.push('recurrence = ?');  args.push(body.recurrence) }
  if ('assignedTo' in body)          { sets.push('assigned_to = ?'); args.push(body.assignedTo ?? null) }
  if ('roomId'     in body)          { sets.push('room_id = ?');     args.push(body.roomId ?? null) }
  if ('nextDue'    in body)          { sets.push('next_due = ?');    args.push(body.nextDue ?? null) }
  if ('notes'      in body)          { sets.push('notes = ?');       args.push(body.notes ?? null) }
  if (body.isPrivate !== undefined)  { sets.push('is_private = ?');  args.push(body.isPrivate ? 1 : 0) }

  if (!sets.length) return c.json({ error: 'Nothing to update' }, 400)
  args.push(taskId)

  await db.execute({ sql: `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, args })
  const updated = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] })
  return c.json({ task: updated.rows[0] })
})

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────────

tasks.delete('/:id', requireAuth, async (c) => {
  const taskId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const db = getDb()

  const taskResult = await db.execute({
    sql: 'SELECT household_id FROM tasks WHERE id = ?',
    args: [taskId],
  })
  const task = taskResult.rows[0]
  if (!task) return c.json({ error: 'Task not found' }, 404)

  if (!(await getMemberId(userId, task.household_id as string))) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  await db.execute({ sql: 'DELETE FROM tasks WHERE id = ?', args: [taskId] })
  return c.body(null, 204)
})

// ── POST /api/tasks/:id/complete ──────────────────────────────────────────────

const CompleteSchema = z.object({
  // The member completing the task (may differ from the caller for child accounts)
  memberId: z.string().min(1),
})

tasks.post('/:id/complete', requireAuth, zValidator('json', CompleteSchema), async (c) => {
  const taskId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const { memberId } = c.req.valid('json')
  const db = getDb()
  const today = todayISO()

  const taskResult = await db.execute({
    sql: 'SELECT id, household_id, recurrence, next_due FROM tasks WHERE id = ?',
    args: [taskId],
  })
  const task = taskResult.rows[0]
  if (!task) return c.json({ error: 'Task not found' }, 404)

  // The caller must be a household member
  if (!(await getMemberId(userId, task.household_id as string))) {
    return c.json({ error: 'Not authorized' }, 403)
  }

  // The completing member must belong to the same household
  const memberResult = await db.execute({
    sql: 'SELECT id FROM members WHERE id = ? AND household_id = ?',
    args: [memberId, task.household_id],
  })
  const member = memberResult.rows[0]
  if (!member) return c.json({ error: 'Member not found in this household' }, 404)

  // Prevent double-completion on the same calendar day
  const dupCheck = await db.execute({
    sql: 'SELECT id FROM completions WHERE task_id = ? AND member_id = ? AND completed_date = ?',
    args: [taskId, memberId, today],
  })
  if (dupCheck.rows.length) return c.json({ error: 'Already completed today' }, 409)

  const completionId = generateId()
  const nextDue = calcNextDue(task.recurrence as string, task.next_due as string | null)

  // Batch the two writes atomically
  await db.batch([
    {
      sql: 'INSERT INTO completions (id, task_id, member_id, household_id, completed_date) VALUES (?, ?, ?, ?, ?)',
      args: [completionId, taskId, memberId, task.household_id, today],
    },
    {
      sql: 'UPDATE tasks SET next_due = ?, last_completed = ? WHERE id = ?',
      args: [nextDue, today, taskId],
    },
  ])

  return c.json({
    completion: {
      id: completionId,
      task_id: taskId,
      member_id: memberId,
      completed_date: today,
    },
    nextDue,
  })
})

export default tasks
