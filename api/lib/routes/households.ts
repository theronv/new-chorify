// ─── Household routes: /api/households/* ─────────────────────────────────────
// This router handles everything scoped to a household:
//   POST   /             — create household
//   POST   /join         — join by invite code
//   GET    /:id          — get household
//   GET    /:id/members  — list members
//   POST   /:id/members  — add child account
//   GET    /:id/tasks    — list tasks
//   POST   /:id/tasks    — create task
//   GET    /:id/completions — list completions (last 30 days)
//   GET    /:id/rewards  — list rewards
//   POST   /:id/rewards  — create reward
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../db'
import { signToken } from '../auth'
import { generateId, generateInviteCode, todayISO } from '../utils'
import { requireAuth } from '../middleware'

const households = new Hono()

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Returns the caller's memberId in this household, or null if not a member. */
async function getMemberId(userId: string, householdId: string): Promise<string | null> {
  const result = await getDb().execute({
    sql: 'SELECT id FROM members WHERE user_id = ? AND household_id = ?',
    args: [userId, householdId],
  })
  return (result.rows[0]?.id as string | null) ?? null
}

const DEFAULT_ROOMS: { name: string; emoji: string; sort_order: number }[] = [
  { name: 'Living Room', emoji: '🛋️', sort_order: 0 },
  { name: 'Kitchen',     emoji: '🍳', sort_order: 1 },
  { name: 'Bedroom',     emoji: '🛏️', sort_order: 2 },
  { name: 'Bathroom',    emoji: '🚿', sort_order: 3 },
  { name: 'Outdoor',     emoji: '🌿', sort_order: 4 },
]

const DEFAULT_CATEGORIES: { name: string; emoji: string; sort_order: number }[] = [
  { name: 'home',    emoji: '🏠', sort_order: 0 },
  { name: 'pet',     emoji: '🐾', sort_order: 1 },
  { name: 'outdoor', emoji: '🌿', sort_order: 2 },
  { name: 'health',  emoji: '❤️', sort_order: 3 },
  { name: 'family',  emoji: '👨‍👩‍👧', sort_order: 4 },
  { name: 'vehicle', emoji: '🚗', sort_order: 5 },
]
const RECURRENCES = [
  'daily', 'weekly', 'biweekly', 'monthly',
  'quarterly', 'biannual', 'annual', 'once',
] as const

// ── POST /api/households — create ─────────────────────────────────────────────

const CreateHouseholdSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  displayName: z.string().min(1).max(50).trim(),
  emoji: z.string().default('🙂'),
})

households.post('/', requireAuth, zValidator('json', CreateHouseholdSchema), async (c) => {
  const { name, displayName, emoji } = c.req.valid('json')
  const { sub: userId } = c.get('token')
  const db = getDb()

  const profile = (
    await db.execute({
      sql: 'SELECT household_id FROM profiles WHERE user_id = ?',
      args: [userId],
    })
  ).rows[0]

  if (profile?.household_id) {
    return c.json({ error: 'You are already in a household' }, 409)
  }

  const householdId = generateId()
  const memberId = generateId()

  // Generate a unique invite code, retrying on the rare collision
  let inviteCode = generateInviteCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const collision = await db.execute({
      sql: 'SELECT id FROM households WHERE invite_code = ?',
      args: [inviteCode],
    })
    if (!collision.rows.length) break
    inviteCode = generateInviteCode()
  }

  const roomInserts = DEFAULT_ROOMS.map((r) => ({
    sql: 'INSERT INTO rooms (id, household_id, name, emoji, sort_order) VALUES (?, ?, ?, ?, ?)',
    args: [generateId(), householdId, r.name, r.emoji, r.sort_order],
  }))

  const categoryInserts = DEFAULT_CATEGORIES.map((cat) => ({
    sql: 'INSERT INTO categories (id, household_id, name, emoji, sort_order) VALUES (?, ?, ?, ?, ?)',
    args: [generateId(), householdId, cat.name, cat.emoji, cat.sort_order],
  }))

  await db.batch([
    {
      sql: 'INSERT INTO households (id, name, invite_code, owner_id) VALUES (?, ?, ?, ?)',
      args: [householdId, name, inviteCode, userId],
    },
    {
      sql: 'INSERT INTO members (id, household_id, user_id, display_name, emoji) VALUES (?, ?, ?, ?, ?)',
      args: [memberId, householdId, userId, displayName, emoji],
    },
    {
      sql: 'UPDATE profiles SET household_id = ?, display_name = ?, emoji = ? WHERE user_id = ?',
      args: [householdId, displayName, emoji, userId],
    },
    ...roomInserts,
    ...categoryInserts,
  ])

  // Issue a new token that now carries householdId + memberId
  const accessToken = await signToken({ sub: userId, hid: householdId, mid: memberId })

  return c.json(
    {
      household: { id: householdId, name, invite_code: inviteCode, owner_id: userId },
      member: { id: memberId, household_id: householdId, user_id: userId, display_name: displayName, emoji, is_child: 0, points_total: 0 },
      accessToken,
    },
    201,
  )
})

// ── POST /api/households/join — join by invite code ───────────────────────────
// Defined BEFORE /:id so Hono doesn't match 'join' as an ID param.

const JoinSchema = z.object({
  inviteCode: z.string().min(1).max(10).trim(),
  displayName: z.string().min(1).max(50).trim(),
  emoji: z.string().default('🙂'),
})

households.post('/join', requireAuth, zValidator('json', JoinSchema), async (c) => {
  const { inviteCode, displayName, emoji } = c.req.valid('json')
  const { sub: userId } = c.get('token')
  const db = getDb()

  const hhResult = await db.execute({
    sql: 'SELECT id, name, invite_code, owner_id FROM households WHERE invite_code = ?',
    args: [inviteCode.toUpperCase()],
  })
  const household = hhResult.rows[0]
  if (!household) return c.json({ error: 'Invalid invite code' }, 404)

  const householdId = household.id as string

  const alreadyMember = await db.execute({
    sql: 'SELECT id FROM members WHERE user_id = ? AND household_id = ?',
    args: [userId, householdId],
  })
  if (alreadyMember.rows.length) {
    return c.json({ error: 'You are already a member of this household' }, 409)
  }

  const memberId = generateId()
  await db.batch([
    {
      sql: 'INSERT INTO members (id, household_id, user_id, display_name, emoji) VALUES (?, ?, ?, ?, ?)',
      args: [memberId, householdId, userId, displayName, emoji],
    },
    {
      sql: 'UPDATE profiles SET household_id = ?, display_name = ?, emoji = ? WHERE user_id = ?',
      args: [householdId, displayName, emoji, userId],
    },
  ])

  const accessToken = await signToken({ sub: userId, hid: householdId, mid: memberId })
  const member = { id: memberId, household_id: householdId, user_id: userId, display_name: displayName, emoji, is_child: 0, points_total: 0 }

  return c.json({ household, member, accessToken })
})

// ── GET /api/households/:id ───────────────────────────────────────────────────

households.get('/:id', requireAuth, async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  const result = await getDb().execute({
    sql: 'SELECT id, name, invite_code, owner_id, created_at FROM households WHERE id = ?',
    args: [householdId],
  })
  if (!result.rows[0]) return c.json({ error: 'Household not found' }, 404)

  return c.json({ household: result.rows[0] })
})

// ── GET /api/households/:id/members ──────────────────────────────────────────

households.get('/:id/members', requireAuth, async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  const result = await getDb().execute({
    sql: 'SELECT * FROM members WHERE household_id = ? ORDER BY created_at ASC',
    args: [householdId],
  })
  return c.json({ members: result.rows })
})

// ── POST /api/households/:id/members — add child account ─────────────────────

const AddChildSchema = z.object({
  displayName: z.string().min(1).max(50).trim(),
  emoji: z.string().default('🧒'),
})

households.post('/:id/members', requireAuth, zValidator('json', AddChildSchema), async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const { displayName, emoji } = c.req.valid('json')
  const db = getDb()

  const parentId = await getMemberId(userId, householdId)
  if (!parentId) return c.json({ error: 'Not a member of this household' }, 403)

  const childId = generateId()
  await db.execute({
    sql: 'INSERT INTO members (id, household_id, user_id, display_name, emoji, is_child, parent_id) VALUES (?, ?, NULL, ?, ?, 1, ?)',
    args: [childId, householdId, displayName, emoji, parentId],
  })

  return c.json(
    {
      member: {
        id: childId,
        household_id: householdId,
        user_id: null,
        display_name: displayName,
        emoji,
        is_child: 1,
        parent_id: parentId,
        points_total: 0,
      },
    },
    201,
  )
})

// ── GET /api/households/:id/rooms ─────────────────────────────────────────────

households.get('/:id/rooms', requireAuth, async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  const result = await getDb().execute({
    sql: 'SELECT * FROM rooms WHERE household_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [householdId],
  })
  return c.json({ rooms: result.rows })
})

// ── POST /api/households/:id/rooms ────────────────────────────────────────────

const CreateRoomSchema = z.object({
  name:  z.string().min(1).max(100).trim(),
  emoji: z.string().min(1).default('🏠'),
})

households.post('/:id/rooms', requireAuth, zValidator('json', CreateRoomSchema), async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const { name, emoji } = c.req.valid('json')

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  const roomId = generateId()
  await getDb().execute({
    sql: 'INSERT INTO rooms (id, household_id, name, emoji) VALUES (?, ?, ?, ?)',
    args: [roomId, householdId, name, emoji],
  })

  return c.json(
    { room: { id: roomId, household_id: householdId, name, emoji, sort_order: 0, created_at: new Date().toISOString() } },
    201,
  )
})

// ── GET /api/households/:id/categories ───────────────────────────────────────

households.get('/:id/categories', requireAuth, async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const db = getDb()

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  let result = await db.execute({
    sql: 'SELECT * FROM categories WHERE household_id = ? ORDER BY sort_order ASC, created_at ASC',
    args: [householdId],
  })

  // Lazy-seed defaults for households created before categories were introduced
  if (result.rows.length === 0) {
    const inserts = DEFAULT_CATEGORIES.map((cat) => ({
      sql: 'INSERT INTO categories (id, household_id, name, emoji, sort_order) VALUES (?, ?, ?, ?, ?)',
      args: [generateId(), householdId, cat.name, cat.emoji, cat.sort_order],
    }))
    await db.batch(inserts)
    result = await db.execute({
      sql: 'SELECT * FROM categories WHERE household_id = ? ORDER BY sort_order ASC, created_at ASC',
      args: [householdId],
    })
  }

  return c.json({ categories: result.rows })
})

// ── POST /api/households/:id/categories ──────────────────────────────────────

const CreateCategorySchema = z.object({
  name:  z.string().min(1).max(100).trim(),
  emoji: z.string().min(1).default('📦'),
})

households.post('/:id/categories', requireAuth, zValidator('json', CreateCategorySchema), async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const { name, emoji } = c.req.valid('json')
  const db = getDb()

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  // Determine next sort_order
  const maxResult = await db.execute({
    sql: 'SELECT MAX(sort_order) as max_order FROM categories WHERE household_id = ?',
    args: [householdId],
  })
  const maxOrder = (maxResult.rows[0]?.max_order as number | null) ?? -1

  const categoryId = generateId()
  const sortOrder = maxOrder + 1

  await db.execute({
    sql: 'INSERT INTO categories (id, household_id, name, emoji, sort_order) VALUES (?, ?, ?, ?, ?)',
    args: [categoryId, householdId, name, emoji, sortOrder],
  })

  return c.json(
    {
      category: {
        id:           categoryId,
        household_id: householdId,
        name,
        emoji,
        sort_order:   sortOrder,
        created_at:   new Date().toISOString(),
      },
    },
    201,
  )
})

// ── GET /api/households/:id/tasks ─────────────────────────────────────────────

households.get('/:id/tasks', requireAuth, async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  const result = await getDb().execute({
    sql: 'SELECT * FROM tasks WHERE household_id = ? ORDER BY next_due ASC',
    args: [householdId],
  })
  return c.json({ tasks: result.rows })
})

// ── POST /api/households/:id/tasks ────────────────────────────────────────────

const CreateTaskSchema = z.object({
  title:      z.string().min(1).max(100).trim(),
  category:   z.string().min(1).max(100).default('home'),
  recurrence: z.enum(RECURRENCES).default('weekly'),
  assignedTo: z.string().nullable().optional(),
  roomId:     z.string().nullable().optional(),
  notes:      z.string().max(500).optional(),
})

households.post('/:id/tasks', requireAuth, zValidator('json', CreateTaskSchema), async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const body = c.req.valid('json')

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  const taskId = generateId()
  const nextDue = todayISO()

  await getDb().execute({
    sql: `INSERT INTO tasks (id, household_id, title, category, recurrence, assigned_to, room_id, next_due, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [taskId, householdId, body.title, body.category, body.recurrence, body.assignedTo ?? null, body.roomId ?? null, nextDue, body.notes ?? null],
  })

  return c.json(
    {
      task: {
        id:           taskId,
        household_id: householdId,
        title:        body.title,
        category:     body.category,
        recurrence:   body.recurrence,
        assigned_to:  body.assignedTo ?? null,
        room_id:      body.roomId ?? null,
        next_due:     nextDue,
        notes:        body.notes ?? null,
      },
    },
    201,
  )
})

// ── GET /api/households/:id/completions (last 30 days) ────────────────────────

households.get('/:id/completions', requireAuth, async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 30)
  const sinceStr = since.toISOString().split('T')[0]

  const result = await getDb().execute({
    sql: `SELECT * FROM completions
          WHERE household_id = ? AND completed_date >= ?
          ORDER BY completed_at DESC`,
    args: [householdId, sinceStr],
  })
  return c.json({ completions: result.rows })
})

// ── GET /api/households/:id/rewards ──────────────────────────────────────────

households.get('/:id/rewards', requireAuth, async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  const result = await getDb().execute({
    sql: 'SELECT * FROM rewards WHERE household_id = ? ORDER BY points_required ASC',
    args: [householdId],
  })
  return c.json({ rewards: result.rows })
})

// ── POST /api/households/:id/rewards ─────────────────────────────────────────

const CreateRewardSchema = z.object({
  title: z.string().min(1).max(100).trim(),
  emoji: z.string().default('🎁'),
  pointsRequired: z.number().int().min(1),
  assignedTo: z.string().nullable().optional(),
})

households.post('/:id/rewards', requireAuth, zValidator('json', CreateRewardSchema), async (c) => {
  const householdId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const body = c.req.valid('json')

  if (!(await getMemberId(userId, householdId))) {
    return c.json({ error: 'Not a member of this household' }, 403)
  }

  const rewardId = generateId()
  await getDb().execute({
    sql: 'INSERT INTO rewards (id, household_id, title, emoji, points_required, assigned_to) VALUES (?, ?, ?, ?, ?, ?)',
    args: [rewardId, householdId, body.title, body.emoji, body.pointsRequired, body.assignedTo ?? null],
  })

  return c.json(
    {
      reward: {
        id: rewardId,
        household_id: householdId,
        title: body.title,
        emoji: body.emoji,
        points_required: body.pointsRequired,
        assigned_to: body.assignedTo ?? null,
      },
    },
    201,
  )
})

export default households
