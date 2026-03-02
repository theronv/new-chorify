// ── Keptt Zustand stores ──────────────────────────────────────────────────────
// auth  — tokens + decoded JWT claims
// household — household data, members, tasks, completions, rewards

import { create } from 'zustand'
import type {
  Completion,
  Household,
  LoginResponse,
  Member,
  Reward,
  Task,
} from '@/types'
import { auth as authApi, getStoredTokens, storeTokens, storeAccessToken, households as householdsApi } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeJwt(token: string): { sub: string; hid: string | null; mid: string | null } | null {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return { sub: decoded.sub, hid: decoded.hid ?? null, mid: decoded.mid ?? null }
  } catch {
    return null
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Auth store ────────────────────────────────────────────────────────────────

interface AuthState {
  accessToken:  string | null
  refreshToken: string | null
  userId:       string | null
  householdId:  string | null
  memberId:     string | null
  isHydrated:   boolean

  hydrate:           () => Promise<void>
  setTokens:         (tokens: LoginResponse) => void
  /** Update only the access token after household create/join (no refresh token rotation). */
  updateAccessToken: (accessToken: string) => Promise<void>
  clearAuth:         () => void
  logout:            () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken:  null,
  refreshToken: null,
  userId:       null,
  householdId:  null,
  memberId:     null,
  isHydrated:   false,

  hydrate: async () => {
    const stored = await getStoredTokens()
    if (stored) {
      const claims = decodeJwt(stored.accessToken)
      set({
        accessToken:  stored.accessToken,
        refreshToken: stored.refreshToken,
        userId:       claims?.sub ?? null,
        householdId:  claims?.hid ?? null,
        memberId:     claims?.mid ?? null,
        isHydrated:   true,
      })
    } else {
      set({ isHydrated: true })
    }
  },

  setTokens: (tokens: LoginResponse) => {
    storeTokens(tokens)
    const claims = decodeJwt(tokens.accessToken)
    set({
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userId:       claims?.sub ?? null,
      householdId:  claims?.hid ?? null,
      memberId:     claims?.mid ?? null,
    })
  },

  updateAccessToken: async (accessToken: string) => {
    await storeAccessToken(accessToken)
    const claims = decodeJwt(accessToken)
    set({
      accessToken,
      householdId: claims?.hid ?? null,
      memberId:    claims?.mid ?? null,
    })
  },

  clearAuth: () =>
    set({
      accessToken:  null,
      refreshToken: null,
      userId:       null,
      householdId:  null,
      memberId:     null,
    }),

  logout: async () => {
    await authApi.logout()
    set({
      accessToken:  null,
      refreshToken: null,
      userId:       null,
      householdId:  null,
      memberId:     null,
    })
  },
}))

// ── Household store ───────────────────────────────────────────────────────────

interface HouseholdState {
  household:   Household | null
  members:     Member[]
  tasks:       Task[]
  completions: Completion[]
  rewards:     Reward[]
  isLoading:   boolean

  load:           (householdId: string) => Promise<void>
  addCompletion:  (c: Completion) => void
  updateTask:     (taskId: string, patch: Partial<Task>) => void
  addTask:        (task: Task) => void
  removeTask:     (taskId: string) => void
  addMember:      (member: Member) => void
  updateMember:   (memberId: string, patch: Partial<Member>) => void
  addReward:      (reward: Reward) => void
  clear:          () => void
}

export const useHouseholdStore = create<HouseholdState>((set) => ({
  household:   null,
  members:     [],
  tasks:       [],
  completions: [],
  rewards:     [],
  isLoading:   false,

  load: async (householdId) => {
    set({ isLoading: true })
    try {
      const [{ household }, { members }, { tasks }, { completions }, { rewards }] =
        await Promise.all([
          householdsApi.get(householdId),
          householdsApi.members(householdId),
          householdsApi.tasks(householdId),
          householdsApi.completions(householdId),
          householdsApi.rewards(householdId),
        ])
      set({ household, members, tasks, completions, rewards })
    } finally {
      set({ isLoading: false })
    }
  },

  addCompletion: (c) =>
    set((s) => ({ completions: [c, ...s.completions] })),

  updateTask: (taskId, patch) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    })),

  addTask: (task) =>
    set((s) => ({ tasks: [task, ...s.tasks] })),

  removeTask: (taskId) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) })),

  addMember: (member) =>
    set((s) => ({ members: [...s.members, member] })),

  updateMember: (memberId, patch) =>
    set((s) => ({
      members: s.members.map((m) => (m.id === memberId ? { ...m, ...patch } : m)),
    })),

  addReward: (reward) =>
    set((s) => ({ rewards: [...s.rewards, reward] })),

  clear: () =>
    set({ household: null, members: [], tasks: [], completions: [], rewards: [] }),
}))

// ── Computed selectors ────────────────────────────────────────────────────────

/** Tasks due today or overdue (next_due <= today) */
export function selectTodaysTasks(tasks: Task[]): Task[] {
  const today = todayISO()
  return tasks.filter((t) => t.next_due != null && t.next_due <= today)
}

/** Tasks due in the next 7 days (exclusive of today) */
export function selectUpcomingTasks(tasks: Task[]): Task[] {
  const today = todayISO()
  const week  = new Date()
  week.setDate(week.getDate() + 7)
  const weekStr = week.toISOString().slice(0, 10)
  return tasks.filter(
    (t) => t.next_due != null && t.next_due > today && t.next_due <= weekStr,
  )
}

/** Whether a task was completed today by any member */
export function selectIsCompletedToday(taskId: string, completions: Completion[]): boolean {
  const today = todayISO()
  return completions.some((c) => c.task_id === taskId && c.completed_date === today)
}

/** Total points earned by a member in the last 30 days */
export function selectMemberPoints(memberId: string, completions: Completion[]): number {
  return completions
    .filter((c) => c.member_id === memberId)
    .reduce((sum, c) => sum + c.points, 0)
}

/** Consecutive-day streak for a member */
export function selectStreak(memberId: string, completions: Completion[]): number {
  const dates = [...new Set(
    completions
      .filter((c) => c.member_id === memberId)
      .map((c) => c.completed_date),
  )].sort().reverse()

  if (dates.length === 0) return 0
  let streak  = 0
  let current = new Date()
  current.setHours(0, 0, 0, 0)

  for (const date of dates) {
    const d = new Date(date + 'T00:00:00Z')
    const diffDays = Math.round((current.getTime() - d.getTime()) / 86_400_000)
    if (diffDays > 1) break
    streak++
    current = d
  }
  return streak
}
