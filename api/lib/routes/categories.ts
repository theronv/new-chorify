// ─── Category item routes: /api/categories/* ─────────────────────────────────
// Item-level operations on a specific category.
// Household-scoped routes (list, create) live in households.ts.
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '../db'
import { requireAuth } from '../middleware'

const categories = new Hono()

async function getCategoryMeta(categoryId: string): Promise<{ household_id: string; name: string } | null> {
  const result = await getDb().execute({
    sql: 'SELECT household_id, name FROM categories WHERE id = ?',
    args: [categoryId],
  })
  if (!result.rows[0]) return null
  return {
    household_id: result.rows[0].household_id as string,
    name:         result.rows[0].name as string,
  }
}

async function getMemberId(userId: string, householdId: string): Promise<string | null> {
  const result = await getDb().execute({
    sql: 'SELECT id FROM members WHERE user_id = ? AND household_id = ?',
    args: [userId, householdId],
  })
  return (result.rows[0]?.id as string | null) ?? null
}

// ── PATCH /api/categories/:id ─────────────────────────────────────────────────

const UpdateCategorySchema = z.object({
  name:  z.string().min(1).max(100).trim().optional(),
  emoji: z.string().min(1).optional(),
})

categories.patch('/:id', requireAuth, zValidator('json', UpdateCategorySchema), async (c) => {
  const categoryId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const body = c.req.valid('json')
  const db = getDb()

  const meta = await getCategoryMeta(categoryId)
  if (!meta) return c.json({ error: 'Category not found' }, 404)
  if (!(await getMemberId(userId, meta.household_id))) return c.json({ error: 'Not authorized' }, 403)

  const sets: string[] = []
  const args: (string | number)[] = []
  const oldName = meta.name

  if (body.name  !== undefined) { sets.push('name = ?');  args.push(body.name) }
  if (body.emoji !== undefined) { sets.push('emoji = ?'); args.push(body.emoji) }
  if (!sets.length) return c.json({ error: 'Nothing to update' }, 400)
  args.push(categoryId)

  await db.execute({ sql: `UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, args })

  // If the name changed, bulk-update all tasks in this household that used the old name
  if (body.name !== undefined && body.name !== oldName) {
    await db.execute({
      sql: 'UPDATE tasks SET category = ? WHERE household_id = ? AND category = ?',
      args: [body.name, meta.household_id, oldName],
    })
  }

  const updated = await db.execute({
    sql: 'SELECT * FROM categories WHERE id = ?',
    args: [categoryId],
  })
  return c.json({ category: updated.rows[0] })
})

// ── DELETE /api/categories/:id ────────────────────────────────────────────────

categories.delete('/:id', requireAuth, async (c) => {
  const categoryId = c.req.param('id')
  const { sub: userId } = c.get('token')
  const db = getDb()

  const meta = await getCategoryMeta(categoryId)
  if (!meta) return c.json({ error: 'Category not found' }, 404)
  if (!(await getMemberId(userId, meta.household_id))) return c.json({ error: 'Not authorized' }, 403)

  // Find remaining categories (excluding the one being deleted)
  const remaining = await db.execute({
    sql: 'SELECT id, name FROM categories WHERE household_id = ? AND id != ? ORDER BY sort_order ASC, created_at ASC',
    args: [meta.household_id, categoryId],
  })

  if (remaining.rows.length === 0) {
    return c.json({ error: 'Cannot delete the last category' }, 409)
  }

  const fallbackName = remaining.rows[0].name as string

  // Reassign tasks that used this category to the first remaining one
  await db.execute({
    sql: 'UPDATE tasks SET category = ? WHERE household_id = ? AND category = ?',
    args: [fallbackName, meta.household_id, meta.name],
  })

  await db.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [categoryId] })
  return c.body(null, 204)
})

export default categories
