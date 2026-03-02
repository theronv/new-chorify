// ─── Cron routes: /api/cron/* ─────────────────────────────────────────────────
// Called by Vercel Cron Jobs (or cron-job.org on free tier) on a daily schedule.
// Protected by CRON_SECRET — Vercel injects this automatically; external callers
// must set Authorization: Bearer <CRON_SECRET> themselves.
import { Hono } from 'hono'
import { getDb } from '../db'
import { requireCron } from '../middleware'
import { todayISO } from '../utils'

const cron = new Hono()

// ── GET /api/cron/notifications ───────────────────────────────────────────────
// Finds every non-child member with a push token who has at least one task due
// today or overdue that they haven't already completed today.
// Sends a single grouped notification per member via Expo's Push API.

cron.get('/notifications', requireCron, async (c) => {
  const db = getDb()
  const today = todayISO()

  // One query: members with due/overdue incomplete tasks, grouped by member.
  // Excludes child accounts (no push token, parent monitors for them).
  const result = await db.execute({
    sql: `
      SELECT
        m.id          AS member_id,
        m.push_token,
        m.display_name,
        COUNT(t.id)   AS due_count
      FROM members m
      JOIN tasks t
        ON  t.household_id = m.household_id
        AND t.next_due    <= ?
        AND (t.assigned_to = m.id OR t.assigned_to IS NULL)
      LEFT JOIN completions c
        ON  c.task_id        = t.id
        AND c.member_id      = m.id
        AND c.completed_date = ?
      WHERE m.push_token IS NOT NULL
        AND m.is_child  = 0
        AND c.id        IS NULL   -- task not yet completed today
      GROUP BY m.id
      HAVING due_count > 0
    `,
    args: [today, today],
  })

  if (!result.rows.length) {
    return c.json({ sent: 0, message: 'No pending notifications' })
  }

  // Build Expo push messages (one per member, grouped by due count)
  const messages = result.rows.map(row => ({
    to: row.push_token as string,
    title: 'Keptt',
    body:
      (row.due_count as number) === 1
        ? 'You have a chore due today'
        : `You have ${row.due_count} chores due today`,
    data: { screen: 'today' },
    sound: 'default' as const,
    badge: row.due_count as number,
  }))

  // Expo Push API accepts up to 100 messages per request
  let sent = 0
  const errors: unknown[] = []

  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100)
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(batch),
      })
      if (res.ok) {
        sent += batch.length
      } else {
        errors.push(await res.text())
      }
    } catch (err) {
      errors.push(String(err))
    }
  }

  return c.json({
    sent,
    total: messages.length,
    ...(errors.length ? { errors } : {}),
  })
})

export default cron
