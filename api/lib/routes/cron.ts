// ─── Cron routes: /api/cron/* ─────────────────────────────────────────────────
// Called by Vercel Cron Jobs (or cron-job.org on free tier) on a daily schedule.
// Protected by CRON_SECRET — Vercel injects this automatically; external callers
// must set Authorization: Bearer <CRON_SECRET> themselves.
import { Hono } from 'hono'
import { getDb } from '../db'
import { requireCron } from '../middleware'
import { todayISO } from '../utils'

const cron = new Hono()

type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } }

// ── GET /api/cron/notifications ───────────────────────────────────────────────
// Finds every non-child member with a push token who has at least one task due
// today or overdue that they haven't already completed today.
// Sends a single grouped notification per member via Expo's Push API.
// Dead tokens (DeviceNotRegistered) are nulled out after each send batch.

cron.get('/notifications', requireCron, async (c) => {
  const db = getDb()
  const today = todayISO()

  // One query: members with due/overdue incomplete tasks, grouped by member.
  // Excludes child accounts (no push token, parent monitors for them).
  // Excludes members already notified today (idempotency).
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
        AND (m.last_notified_date IS NULL OR m.last_notified_date < ?)
      GROUP BY m.id
      HAVING due_count > 0
    `,
    args: [today, today, today],
  })

  if (!result.rows.length) {
    return c.json({ sent: 0, message: 'No pending notifications' })
  }

  // Pair each message with its member ID so we can map ticket results back
  const rows = result.rows.map(row => ({
    memberId:  row.member_id  as string,
    pushToken: row.push_token as string,
    dueCount:  row.due_count  as number,
  }))

  // Expo Push API accepts up to 100 messages per request
  let sent = 0
  const errors: string[] = []
  const deadMemberIds: string[] = []
  const sentMemberIds: string[] = []

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const messages = batch.map(r => ({
      to:    r.pushToken,
      title: 'Chorify',
      body:
        r.dueCount === 1
          ? 'You have a chore due today'
          : `You have ${r.dueCount} chores due today`,
      data:  { screen: 'today' },
      sound: 'default' as const,
      badge: r.dueCount,
    }))

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
        },
        body: JSON.stringify(messages),
      })

      if (!res.ok) {
        errors.push(`HTTP ${res.status}: ${await res.text()}`)
        continue  // Don't mark these members as notified — retry is safe
      }

      const body = await res.json() as { data: ExpoPushTicket[] }
      body.data.forEach((ticket, idx) => {
        if (ticket.status === 'ok') {
          sent++
          sentMemberIds.push(batch[idx].memberId)
        } else {
          errors.push(`${batch[idx].memberId}: ${ticket.message}`)
          // DeviceNotRegistered means the token is permanently dead —
          // null it out so we stop sending to this device
          if (ticket.details?.error === 'DeviceNotRegistered') {
            deadMemberIds.push(batch[idx].memberId)
          }
        }
      })
    } catch (err) {
      errors.push(String(err))
    }
  }

  // Only mark members whose notification was actually delivered
  const notifiedIds = sentMemberIds
  const dbUpdates = [
    // Remove dead push tokens from the database
    ...deadMemberIds.map(id => ({
      sql:  'UPDATE members SET push_token = NULL WHERE id = ?',
      args: [id],
    })),
    // Record notification date for idempotency
    ...notifiedIds.map(id => ({
      sql:  'UPDATE members SET last_notified_date = ? WHERE id = ?',
      args: [today, id],
    })),
  ]
  if (dbUpdates.length) {
    await db.batch(dbUpdates)
  }

  return c.json({
    sent,
    total: rows.length,
    ...(deadMemberIds.length ? { tokensRemoved: deadMemberIds.length } : {}),
    ...(errors.length        ? { errors }                              : {}),
  })
})

export default cron
