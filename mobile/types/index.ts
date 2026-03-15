// ── Chorify shared TypeScript types ───────────────────────────────────────────
// Mirrors the Turso DB schema (TURSO_SCHEMA.sql)

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken:  string
  refreshToken: string
}

export interface TokenPayload {
  sub: string         // userId
  hid: string | null  // householdId (null until onboarding)
  mid: string | null  // memberId    (null until onboarding)
}

// ── Users / Profiles ──────────────────────────────────────────────────────────

export interface User {
  id:         string
  email:      string
  created_at: string
}

export interface Profile {
  id:           string
  user_id:      string
  household_id: string | null
  display_name: string | null
  emoji:        string
  created_at:   string
}

// ── Households ────────────────────────────────────────────────────────────────

export interface Household {
  id:          string
  name:        string
  invite_code: string
  owner_id:    string | null
  created_at:  string
}

// ── Members ───────────────────────────────────────────────────────────────────

export interface Member {
  id:           string
  household_id: string
  user_id:      string | null  // null for child accounts
  display_name: string
  emoji:        string
  is_child:     0 | 1
  parent_id:    string | null
  points_total: number
  push_token:   string | null
  avatar_url:   string | null  // base64 data URI, stored directly in Turso
  created_at:   string
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type Recurrence =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'biannual'
  | 'annual'
  | 'once'
  | `every_${number}_days`

/** Parse a custom "every_N_days" recurrence string, returns N or null. */
export function parseCustomDays(r: string): number | null {
  const m = r.match(/^every_(\d+)_days$/)
  return m ? parseInt(m[1], 10) : null
}

/** Human-readable label for any recurrence value. */
export function recurrenceLabel(r: string): string {
  const labels: Record<string, string> = {
    daily: 'Daily', weekly: 'Weekly', biweekly: 'Biweekly',
    monthly: 'Monthly', quarterly: 'Quarterly', biannual: 'Biannual',
    annual: 'Annual', once: 'One-time',
  }
  if (labels[r]) return labels[r]
  const n = parseCustomDays(r)
  return n !== null ? `Every ${n} days` : r
}

/** Legacy type alias — category is now a free-form string backed by HouseholdCategory */
export type Category = string

export interface HouseholdCategory {
  id:           string
  household_id: string
  name:         string
  emoji:        string
  sort_order:   number
  created_at:   string
}

export interface Room {
  id:           string
  household_id: string
  name:         string
  emoji:        string
  sort_order:   number
  created_at:   string
}

export interface Task {
  id:               string
  household_id:     string
  title:            string
  category:         Category
  recurrence:       Recurrence
  assigned_to:      string | null  // member id
  room_id:          string | null  // room id
  next_due:         string | null  // YYYY-MM-DD
  last_completed:   string | null  // YYYY-MM-DD
  notes:            string | null
  is_private:       number         // 0 = public, 1 = private (only visible to owner)
  owner_member_id:  string | null  // member who created the task
  created_at:       string
}

// ── Completions ───────────────────────────────────────────────────────────────

export interface Completion {
  id:             string
  task_id:        string
  member_id:      string
  household_id:   string
  completed_date: string  // YYYY-MM-DD
  completed_at:   string  // ISO timestamp
}

// ── Rewards ───────────────────────────────────────────────────────────────────

export interface Reward {
  id:              string
  household_id:    string
  title:           string
  emoji:           string
  points_required: number
  assigned_to:     string | null  // member id
  created_at:      string
}

// ── API Request / Response shapes ─────────────────────────────────────────────

export interface SignupRequest  { email: string; password: string; displayName: string }
export interface SignupResponse { accessToken: string; refreshToken: string; user: { id: string; email: string } }
export interface LoginRequest   { email: string; password: string }
export interface LoginResponse  { accessToken: string; refreshToken: string }

export interface CreateHouseholdRequest { name: string; displayName: string; emoji: string }
export interface JoinHouseholdRequest   { inviteCode: string; displayName: string; emoji: string }

export interface CreateTaskRequest {
  title:       string
  category:    Category
  recurrence:  Recurrence
  assignedTo?: string
  roomId?:     string
  nextDue?:    string
  notes?:      string
  isPrivate?:  boolean
}

export interface UpdateTaskRequest {
  title?:      string
  category?:   Category
  recurrence?: Recurrence
  assignedTo?: string | null
  roomId?:     string | null
  nextDue?:    string | null  // YYYY-MM-DD
  notes?:      string | null
  isPrivate?:  boolean
}

export interface CreateRoomRequest {
  name:   string
  emoji?: string
}

export interface UpdateRoomRequest {
  name?:  string
  emoji?: string
}

export interface CreateCategoryRequest {
  name:   string
  emoji?: string
}

export interface UpdateCategoryRequest {
  name?:  string
  emoji?: string
}

export interface CreateMemberRequest {
  displayName: string
  emoji:       string
  parentId?:   string
}

export interface CreateRewardRequest {
  title:          string
  emoji:          string
  pointsRequired: number
  assignedTo?:    string
}

export interface TaskCompleteResponse {
  /** Partial completion — household_id and completed_at are not returned by the server */
  completion: Pick<Completion, 'id' | 'task_id' | 'member_id' | 'completed_date'>
  nextDue: string | null
}

// ── API Error ─────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  status: number
}
