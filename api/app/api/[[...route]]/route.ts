// ─── Hono entry point for Vercel Edge Runtime ─────────────────────────────────
// All requests to /api/* are caught by this Next.js App Router catch-all and
// dispatched through Hono's router.
//
// Edge Runtime constraints met here:
//   • @libsql/client/web  — HTTP-based Turso client (no Node.js WebSocket)
//   • jose                — Web Crypto JWT (no node:crypto)
//   • PBKDF2 via SubtleCrypto — no bcrypt/argon2 native modules
//   • No node-cron        — scheduling handled by Vercel Cron Jobs (vercel.json)
import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import authRoutes from '../../../lib/routes/auth'
import householdRoutes from '../../../lib/routes/households'
import memberRoutes from '../../../lib/routes/members'
import taskRoutes from '../../../lib/routes/tasks'
import roomRoutes from '../../../lib/routes/rooms'
import categoryRoutes from '../../../lib/routes/categories'
import cronRoutes from '../../../lib/routes/cron'

export const runtime = 'edge'

const app = new Hono().basePath('/api')

// ── Global middleware ─────────────────────────────────────────────────────────

// CORS: native apps don't need CORS, but it's useful for local curl/Postman testing.
app.use('*', cors())

// Request logger in development only (console.log is a no-op on Edge in prod)
if (process.env.NODE_ENV !== 'production') {
  app.use('*', logger())
}

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/health', c => c.json({ ok: true, ts: new Date().toISOString() }))

// ── Route registration ────────────────────────────────────────────────────────
//
// Route layout:
//   /api/auth/*                        — signup, login, refresh, logout
//   /api/households                    — create household, join household
//   /api/households/:id                — get household
//   /api/households/:id/members        — list members, add child
//   /api/households/:id/tasks          — list tasks, create task
//   /api/households/:id/completions    — list completions (last 30 days)
//   /api/households/:id/rewards        — list rewards, create reward
//   /api/members/:id                   — update member (push token, name, emoji)
//   /api/tasks/:id                     — delete task
//   /api/tasks/:id/complete            — mark task complete
//   /api/categories/:id                — rename/delete category
//   /api/cron/notifications            — daily push notification job

app.route('/auth', authRoutes)
app.route('/households', householdRoutes)
app.route('/members', memberRoutes)
app.route('/tasks', taskRoutes)
app.route('/rooms', roomRoutes)
app.route('/categories', categoryRoutes)
app.route('/cron', cronRoutes)

// ── Error handlers ────────────────────────────────────────────────────────────

app.notFound(c => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  console.error('[keptt-api]', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// ── Vercel Edge Function exports ──────────────────────────────────────────────
// handle() converts the Hono app into Vercel's expected Request → Response shape.

export const GET = handle(app)
export const POST = handle(app)
export const PATCH = handle(app)
export const DELETE = handle(app)
