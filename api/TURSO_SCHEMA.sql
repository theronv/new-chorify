-- ═══════════════════════════════════════════════════════════════════════════
-- CHORIFY — Turso (libSQL / SQLite) Schema
--
-- Run with: turso db shell chorify-theronv-theronv < TURSO_SCHEMA.sql
-- Or paste into the Turso dashboard → SQL Editor
--
-- Notes:
--   • Turso enables PRAGMA foreign_keys = ON by default
--   • UUIDs are stored as TEXT (SQLite has no native UUID type)
--   • Booleans are stored as INTEGER (0 = false, 1 = true)
--   • Timestamps are stored as TEXT in ISO 8601 format
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Users (replaces Supabase auth.users) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT   NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── 2. Profiles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  household_id TEXT,
  display_name TEXT,
  emoji        TEXT    NOT NULL DEFAULT '🙂',
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── 3. Households ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS households (
  id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name         TEXT    NOT NULL,
  invite_code  TEXT    NOT NULL UNIQUE,
  owner_id     TEXT    REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── 4. Members ────────────────────────────────────────────────────────────────
-- Adults have a user_id; child accounts (is_child = 1) have user_id = NULL
CREATE TABLE IF NOT EXISTS members (
  id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT    NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      TEXT,   -- NULL for child accounts
  display_name TEXT    NOT NULL,
  emoji        TEXT    NOT NULL DEFAULT '🙂',
  is_child     INTEGER NOT NULL DEFAULT 0,
  parent_id    TEXT    REFERENCES members(id) ON DELETE SET NULL,
  points_total INTEGER NOT NULL DEFAULT 0,
  push_token   TEXT,   -- Expo push notification token
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── 5. Tasks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id TEXT    NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  category     TEXT    NOT NULL DEFAULT 'home',
  -- daily | weekly | biweekly | monthly | quarterly | biannual | annual | once
  recurrence   TEXT    NOT NULL DEFAULT 'weekly',
  points       INTEGER NOT NULL DEFAULT 10,
  assigned_to  TEXT    REFERENCES members(id) ON DELETE SET NULL,
  next_due     TEXT,   -- YYYY-MM-DD
  last_completed TEXT, -- YYYY-MM-DD
  notes        TEXT,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── 6. Completions (immutable log) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS completions (
  id             TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  task_id        TEXT    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id      TEXT    NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  household_id   TEXT    NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  completed_date TEXT    NOT NULL, -- YYYY-MM-DD
  completed_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  points         INTEGER NOT NULL DEFAULT 5
);

-- ── 7. Rewards ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id              TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id    TEXT    NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title           TEXT    NOT NULL,
  emoji           TEXT    NOT NULL DEFAULT '🎁',
  points_required INTEGER NOT NULL,
  assigned_to     TEXT    REFERENCES members(id) ON DELETE SET NULL,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── 8. Refresh Tokens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tasks_household      ON tasks(household_id);
CREATE INDEX IF NOT EXISTS idx_tasks_next_due       ON tasks(next_due);
CREATE INDEX IF NOT EXISTS idx_completions_household ON completions(household_id);
CREATE INDEX IF NOT EXISTS idx_completions_date     ON completions(completed_date);
CREATE INDEX IF NOT EXISTS idx_completions_member   ON completions(member_id);
CREATE INDEX IF NOT EXISTS idx_members_household    ON members(household_id);
CREATE INDEX IF NOT EXISTS idx_members_user         ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user        ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_hash         ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_user         ON refresh_tokens(user_id);
