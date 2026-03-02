// ─── Turso / libSQL client ────────────────────────────────────────────────────
// Import from the /web subpath — the standard @libsql/client uses Node.js
// WebSockets and will crash in Vercel Edge Runtime. The /web client uses
// Turso's HTTP API instead, which works everywhere.
import { createClient, type Client } from '@libsql/client/web'

let _client: Client | null = null

export function getDb(): Client {
  // Module-level singleton: reused within a V8 isolate, recreated on cold start.
  if (_client) return _client

  const url = process.env.TURSO_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url || !authToken) {
    throw new Error('TURSO_URL and TURSO_AUTH_TOKEN environment variables are required')
  }

  _client = createClient({ url, authToken })
  return _client
}
