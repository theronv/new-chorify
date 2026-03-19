// ── Chorify Zustand stores ────────────────────────────────────────────────────
// auth  — user identity (synced from Clerk via ClerkSync component)
// household — household data, members, tasks, completions, rooms, categories

import { create } from 'zustand'
import type {
  Completion,
  Household,
  HouseholdCategory,
  Member,
  Room,
  Task,
} from '@/types'
import * as SecureStore from 'expo-secure-store'
import { households as householdsApi, rooms as roomsApi } from '@/lib/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const GAMIFICATION_KEY = 'chorify.gamification_enabled'

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
// With Clerk, this store is a thin bridge. The ClerkSync component in _layout.tsx
// writes userId/householdId/memberId here from Clerk's hooks so non-hook code
// (and existing components) can read them via useAuthStore.

interface AuthState {
  userId:       string | null
  householdId:  string | null
  memberId:     string | null
  isHydrated:   boolean

  /** Called by ClerkSync to push Clerk state into Zustand */
  setClerkState: (state: { userId: string | null; householdId: string | null; memberId: string | null }) => void
  clearAuth:     () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  userId:       null,
  householdId:  null,
  memberId:     null,
  isHydrated:   false,

  setClerkState: ({ userId, householdId, memberId }) => {
    set({ userId, householdId, memberId, isHydrated: true })
  },

  clearAuth: () => {
    useHouseholdStore.getState().clear()
    set({
      userId:      null,
      householdId: null,
      memberId:    null,
    })
  },
}))

// ── Household store ───────────────────────────────────────────────────────────

interface HouseholdState {
  household:   Household | null
  householdId: string | null
  members:     Member[]
  tasks:       Task[]
  completions: Completion[]
  rooms:       Room[]
  categories:  HouseholdCategory[]
  isLoading:   boolean
  loadError:   string | null
  gamificationEnabled: boolean
  isLoadingSettings:   boolean

  load:               (householdId: string, silent?: boolean) => Promise<void>
  hydrateSettings:    () => Promise<void>
  setGamificationEnabled: (enabled: boolean) => Promise<void>
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
  renameCategoryOnTasks: (oldName: string, newName: string) => void
  clear:              () => void
}

export const useHouseholdStore = create<HouseholdState>((set) => ({
  household:   null,
  householdId: null,
  members:     [],
  tasks:       [],
  completions: [],
  rooms:       [],
  categories:  [],
  isLoading:   false,
  loadError:   null,
  gamificationEnabled: false,
  isLoadingSettings:   false,

  hydrateSettings: async () => {
    set({ isLoadingSettings: true })
    try {
      const stored = await SecureStore.getItemAsync(GAMIFICATION_KEY)
      set({ gamificationEnabled: stored === 'true' })
    } catch {
      set({ gamificationEnabled: false })
    } finally {
      set({ isLoadingSettings: false })
    }
  },

  setGamificationEnabled: async (enabled: boolean) => {
    set({ gamificationEnabled: enabled })
    try {
      await SecureStore.setItemAsync(GAMIFICATION_KEY, enabled ? 'true' : 'false')
    } catch {}
  },

  load: async (householdId, silent = false) => {
    set({ isLoading: !silent, loadError: null, householdId })
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
        householdsApi.categories(householdId).catch(() => ({ categories: [] as import('@/types').HouseholdCategory[] })),
      ])
      set({ household, members, tasks, completions, rooms, categories: categoriesResult.categories })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load household data'
      set({ loadError: msg })
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
    set({ household: null, householdId: null, members: [], tasks: [], completions: [], rooms: [], categories: [], loadError: null }),
}))

// ── Computed selectors ────────────────────────────────────────────────────────

export function selectTodaysTasks(tasks: Task[]): Task[] {
  const today = todayISO()
  return tasks.filter((t) => t.next_due != null && t.next_due <= today)
}

export function selectUpcomingTasks(tasks: Task[]): Task[] {
  const today   = todayISO()
  const weekStr = getWeekFromNowString()
  return tasks.filter(
    (t) => t.next_due != null && t.next_due > today && t.next_due <= weekStr,
  )
}

export function selectIsCompletedToday(taskId: string, completions: Completion[]): boolean {
  const today = todayISO()
  return completions.some((c) => c.task_id === taskId && c.completed_date === today)
}

function dateMinus(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10)
}

export function selectStreak(memberId: string, completions: Completion[]): number {
  const dates = [...new Set(
    completions
      .filter((c) => c.member_id === memberId)
      .map((c) => c.completed_date),
  )].sort().reverse()

  if (dates.length === 0) return 0

  const today     = getTodayString()
  const yesterday = dateMinus(today, 1)

  const startDate = dates[0] === today ? today : yesterday

  let streak = 0
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] === dateMinus(startDate, i)) {
      streak++
    } else {
      break
    }
  }
  return streak
}
