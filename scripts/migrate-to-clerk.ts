#!/usr/bin/env npx tsx
// ── Migrate existing Chorify users to Clerk ──────────────────────────────────
// Reads all users from Turso, imports them into Clerk with PBKDF2 password hashes,
// sets externalId + publicMetadata, and writes clerk_id back to Turso.
//
// Usage:
//   cd api && npx tsx ../scripts/migrate-to-clerk.ts
//
// Required env vars (reads from api/.env.local):
//   TURSO_URL, TURSO_AUTH_TOKEN, CLERK_SECRET_KEY

import { createClient } from '@libsql/client'
import { createClerkClient } from '@clerk/backend'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load env from api/.env.local (works whether run from scripts/ or api/)
config({ path: resolve(__dirname, '../api/.env.local') })
config({ path: resolve(__dirname, '.env.local') })

const db = createClient({
  url:       process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
})

/**
 * Reformats the Chorify PBKDF2 hash to Clerk's expected format.
 * Chorify:  base64(salt[16] + hash[32])  — PBKDF2-SHA256, 100k iterations
 * Clerk:    pbkdf2_sha256$100000$<salt_base64>$<hash_base64>
 */
function reformatHash(stored: string): string {
  const combined = Buffer.from(stored, 'base64')
  const salt = combined.subarray(0, 16).toString('base64')
  const hash = combined.subarray(16).toString('base64')
  return `pbkdf2_sha256$100000$${salt}$${hash}`
}

async function main() {
  console.log('Fetching users from Turso...')

  const result = await db.execute(`
    SELECT u.id, u.email, u.password_hash, u.clerk_id,
           p.household_id, p.display_name,
           m.id as member_id
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN members m ON m.user_id = u.id AND m.household_id = p.household_id
  `)

  console.log(`Found ${result.rows.length} users`)

  let imported = 0
  let skipped = 0
  let errors = 0

  for (const row of result.rows) {
    const userId       = row.id as string
    const email        = row.email as string
    const passwordHash = row.password_hash as string
    const clerkId      = row.clerk_id as string | null
    const householdId  = row.household_id as string | null
    const displayName  = row.display_name as string | null
    const memberId     = row.member_id as string | null

    // Skip if already migrated
    if (clerkId) {
      console.log(`  SKIP ${email} — already has clerk_id ${clerkId}`)
      skipped++
      continue
    }

    // Skip test/smoke users
    if (email.includes('@test.dev')) {
      console.log(`  SKIP ${email} — test account`)
      skipped++
      continue
    }

    try {
      console.log(`  Importing ${email}...`)

      const clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        passwordDigest: reformatHash(passwordHash),
        passwordHasher: 'pbkdf2_sha256',
        externalId: userId,
        firstName: displayName ?? undefined,
        publicMetadata: {
          householdId: householdId ?? undefined,
          memberId: memberId ?? undefined,
        },
        skipPasswordChecks: true,
      })

      // Write clerk_id back to Turso
      await db.execute({
        sql: 'UPDATE users SET clerk_id = ? WHERE id = ?',
        args: [clerkUser.id, userId],
      })

      console.log(`  OK → ${clerkUser.id}`)
      imported++
    } catch (e: any) {
      console.error(`  ERROR ${email}:`, e?.errors?.[0]?.message ?? e.message ?? e)
      errors++
    }
  }

  console.log(`\nDone: ${imported} imported, ${skipped} skipped, ${errors} errors`)
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
