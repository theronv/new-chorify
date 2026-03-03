// ── Chorify Zustand stores ────────────────────────────────────────────────────
// auth  — tokens + decoded JWT claims
// household — household data, members, tasks, completions, rooms, categories

import { create } from 'zustand'
import type {
  Completion,
  Household,
  HouseholdCategory,
  LoginResponse,
  Member,
  Room,
  Task,
} from '@/types'
import { auth as authApi, getStoredTokens, storeTokens, storeAccessToken, households as householdsApi, rooms as roomsApi } from '@/lib/api'

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

// ── Timezone-aware date helpers ───────────────────────────────────────────────

let _tz = 'America/Los_Angeles'

/** Called once on app startup (and whenever the user changes the pref). */
export function setStoreTimezone(tz: string): void { _tz = tz }

/** Today's date as YYYY-MM-DD in the app timezone. */
export function getTodayString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: _tz })
}

/** 7 days from now as YYYY-MM-DD in the app timezone. */
export function getWeekFromNowString(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toLocaleDateString('en-CA', { timeZone: _tz })
}

function todayISO(): string {
  return getTodayString()
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
  rooms:       Room[]
  categories:  HouseholdCategory[]
  isLoading:   boolean

  load:               (householdId: string) => Promise<void>
  addCompletion:      (c: Completion) => void
  updateTask:         (taskId: string, patch: Partial<Task>) => void
  addTask:            (task: Task) => void
  removeTask:         (taskId: string) => void
  addMember:          (member: Member) => void
  updateMember:       (memberId: string, patch: Partial<Member>) => void
  addRoom:            (room: Room) => void
  updateRoom:         (roomId: string, patch: Partial<Room>) => void
  removeRoom:         (roomId: string) => void
  addCategory:        (category: HouseholdCategory) => void
  updateCategory:     (categoryId: string, patch: Partial<HouseholdCategory>) => void
  removeCategory:     (categoryId: string) => void
  /** After a category rename, update the category name on all in-memory tasks */
  renameCategoryOnTasks: (oldName: string, newName: string) => void
  clear:              () => void
}

export const useHouseholdStore = create<HouseholdState>((set) => ({
  household:   null,
  members:     [],
  tasks:       [],
  completions: [],
  rooms:       [],
  categories:  [],
  isLoading:   false,

  load: async (householdId) => {
    set({ isLoading: true })
    try {
      const [
        { household }, { members }, { tasks }, { completions }, { rooms },
        categoriesResult,
      ] = await Promise.all([
        householdsApi.get(householdId),
        householdsApi.members(householdId),
        householdsApi.tasks(householdId),
        householdsApi.completions(householdId),
        householdsApi.rooms(householdId),
        // Graceful fallback: categories table may not exist on older deployments
        householdsApi.categories(householdId).catch(() => ({ categories: [] as import('@/types').HouseholdCategory[] })),
      ])
      set({ household, members, tasks, completions, rooms, categories: categoriesResult.categories })
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

  addRoom: (room) =>
    set((s) => ({ rooms: [...s.rooms, room] })),

  updateRoom: (roomId, patch) =>
    set((s) => ({
      rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)),
    })),

  removeRoom: (roomId) =>
    set((s) => ({ rooms: s.rooms.filter((r) => r.id !== roomId) })),

  addCategory: (category) =>
    set((s) => ({ categories: [...s.categories, category] })),

  updateCategory: (categoryId, patch) =>
    set((s) => ({
      categories: s.categories.map((cat) => (cat.id === categoryId ? { ...cat, ...patch } : cat)),
    })),

  removeCategory: (categoryId) =>
    set((s) => ({ categories: s.categories.filter((cat) => cat.id !== categoryId) })),

  renameCategoryOnTasks: (oldName, newName) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.category === oldName ? { ...t, category: newName } : t)),
    })),

  clear: () =>
    set({ household: null, members: [], tasks: [], completions: [], rooms: [], categories: [] }),
}))

// ── Computed selectors ────────────────────────────────────────────────────────

/** Tasks due today or overdue (next_due <= today) */
export function selectTodaysTasks(tasks: Task[]): Task[] {
  const today = todayISO()
  return tasks.filter((t) => t.next_due != null && t.next_due <= today)
}

/** Tasks due in the next 7 days (exclusive of today) */
export function selectUpcomingTasks(tasks: Task[]): Task[] {
  const today   = todayISO()
  const weekStr = getWeekFromNowString()
  return tasks.filter(
    (t) => t.next_due != null && t.next_due > today && t.next_due <= weekStr,
  )
}

/** Whether a task was completed today by any member */
export function selectIsCompletedToday(taskId: string, completions: Completion[]): boolean {
  const today = todayISO()
  return completions.some((c) => c.task_id === taskId && c.completed_date === today)
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
