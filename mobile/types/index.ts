// ── Keptt shared TypeScript types ─────────────────────────────────────────────
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
  id:             string
  household_id:   string
  title:          string
  category:       Category
  recurrence:     Recurrence
  points:         number
  assigned_to:    string | null  // member id
  room_id:        string | null  // room id
  next_due:       string | null  // YYYY-MM-DD
  last_completed: string | null  // YYYY-MM-DD
  notes:          string | null
  created_at:     string
}

// ── Completions ───────────────────────────────────────────────────────────────

export interface Completion {
  id:             string
  task_id:        string
  member_id:      string
  household_id:   string
  completed_date: string  // YYYY-MM-DD
  completed_at:   string  // ISO timestamp
  points:         number
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
  points:      number
  assignedTo?: string
  roomId?:     string
  nextDue?:    string
  notes?:      string
}

export interface UpdateTaskRequest {
  title?:      string
  category?:   Category
  recurrence?: Recurrence
  points?:     number
  assignedTo?: string | null
  roomId?:     string | null
  nextDue?:    string | null  // YYYY-MM-DD
  notes?:      string | null
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
  completion: Pick<Completion, 'id' | 'task_id' | 'member_id' | 'completed_date' | 'points'>
  newPointsTotal: number
  nextDue: string | null
}

// ── API Error ─────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  status: number
}
