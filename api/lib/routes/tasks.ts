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
    sql: 'SELECT id, household_id, points, recurrence FROM tasks WHERE id = ?',
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
    sql: 'SELECT id, points_total FROM members WHERE id = ? AND household_id = ?',
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
  const points = task.points as number
  const nextDue = calcNextDue(task.recurrence as string)
  const newPointsTotal = (member.points_total as number) + points

  // Batch the three writes atomically
  await db.batch([
    {
      sql: 'INSERT INTO completions (id, task_id, member_id, household_id, completed_date, points) VALUES (?, ?, ?, ?, ?, ?)',
      args: [completionId, taskId, memberId, task.household_id, today, points],
    },
    {
      sql: 'UPDATE tasks SET next_due = ?, last_completed = ? WHERE id = ?',
      args: [nextDue, today, taskId],
    },
    {
      sql: 'UPDATE members SET points_total = ? WHERE id = ?',
      args: [newPointsTotal, memberId],
    },
  ])

  return c.json({
    completion: {
      id: completionId,
      task_id: taskId,
      member_id: memberId,
      completed_date: today,
      points,
    },
    newPointsTotal,
    nextDue,
  })
})

export default tasks
