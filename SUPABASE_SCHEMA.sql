-- ═══════════════════════════════════════════════════════════════════════════
-- CHORIFY - Supabase Database Schema
-- Run this in your Supabase project's SQL Editor (Database → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Profiles ──────────────────────────────────────────────────────────────
-- Links Supabase auth users to their household
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  household_id UUID,
  display_name TEXT,
  emoji TEXT DEFAULT '🙂',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Households ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS households (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Members ────────────────────────────────────────────────────────────────
-- Can be real users (adults) or child accounts (no auth user)
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id UUID, -- NULL for child accounts
  display_name TEXT NOT NULL,
  emoji TEXT DEFAULT '🙂',
  is_child BOOLEAN DEFAULT FALSE,
  parent_id UUID REFERENCES members(id) ON DELETE SET NULL,
  points_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Tasks ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'home', -- home | pet | outdoor | health | family | vehicle
  recurrence TEXT DEFAULT 'weekly', -- daily | weekly | biweekly | monthly | quarterly | biannual | annual | once
  recurrence_interval INTEGER DEFAULT 1,
  points INTEGER DEFAULT 10,
  assigned_to UUID REFERENCES members(id) ON DELETE SET NULL,
  next_due DATE,
  last_completed DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Completions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  completed_date DATE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  points INTEGER DEFAULT 5
);

-- ── 6. Rewards ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT DEFAULT '🎁',
  points_required INTEGER NOT NULL,
  assigned_to UUID REFERENCES members(id) ON DELETE SET NULL,
  redeemed BOOLEAN DEFAULT FALSE,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Makes sure users can only see their own household's data
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- Profiles: users manage their own
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = user_id);

-- Households: members of household can read; owner can modify
CREATE POLICY "Household members can read" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM members WHERE user_id = auth.uid())
    OR id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can create household" ON households
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owner can update household" ON households
  FOR UPDATE USING (owner_id = auth.uid());

-- Members: visible to household members
CREATE POLICY "Household members can see members" ON members
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create members" ON members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their household members" ON members
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

-- Tasks: accessible by household members
CREATE POLICY "Household members can view tasks" ON tasks
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can create tasks" ON tasks
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can update tasks" ON tasks
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can delete tasks" ON tasks
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

-- Completions
CREATE POLICY "Household members can view completions" ON completions
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Household members can create completions" ON completions
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

-- Rewards
CREATE POLICY "Household members can manage rewards" ON rewards
  FOR ALL USING (
    household_id IN (SELECT household_id FROM profiles WHERE user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- USEFUL INDEXES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tasks_household ON tasks(household_id);
CREATE INDEX IF NOT EXISTS idx_tasks_next_due ON tasks(next_due);
CREATE INDEX IF NOT EXISTS idx_completions_household ON completions(household_id);
CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(completed_date);
CREATE INDEX IF NOT EXISTS idx_members_household ON members(household_id);
CREATE INDEX IF NOT EXISTS idx_members_user ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Your Chorify database is ready.
-- Next: copy your Project URL and anon key from
-- Project Settings → API and paste into src/lib/supabase.js
-- ═══════════════════════════════════════════════════════════════════════════
