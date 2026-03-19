// ── Chorify API client ────────────────────────────────────────────────────────
// Typed wrapper around the Hono/Vercel API.
// With Clerk: Bearer token is injected via getToken() from @clerk/clerk-expo.
// Legacy token storage kept for migration period only.

import * as SecureStore from 'expo-secure-store'
import type {
  AuthTokens,
  Completion,
  CreateCategoryRequest,
  CreateHouseholdRequest,
  CreateMemberRequest,
  CreateRoomRequest,
  CreateTaskRequest,
  Household,
  HouseholdCategory,
  JoinHouseholdRequest,
  LoginRequest,
  LoginResponse,
  Member,
  Room,
  SignupRequest,
  SignupResponse,
  Task,
  TaskCompleteResponse,
  UpdateCategoryRequest,
  UpdateRoomRequest,
  UpdateTaskRequest,
} from '@/types'

// ── Base URL ─────────────────────────────────────────────────────────────────
const BASE_URL = (() => {
  const url = process.env.EXPO_PUBLIC_API_URL
  if (__DEV__ && !url) {
    console.warn(
      '[api] EXPO_PUBLIC_API_URL is not set.\n' +
      'Copy mobile/.env.example → mobile/.env.local and fill in your machine\'s LAN IP.\n' +
      'iOS Simulator cannot use localhost — it resolves to the simulator, not the host.',
    )
  }
  return url ?? 'http://localhost:3000'
})()
if (__DEV__) console.log('[api] BASE_URL:', BASE_URL)

// ── Clerk token getter ───────────────────────────────────────────────────────
// Set by ClerkSync component in _layout.tsx once Clerk is loaded.
// This allows non-hook code (this module) to get the current Clerk session token.

let _getToken: (() => Promise<string | null>) | null = null

export function setTokenGetter(fn: () => Promise<string | null>): void {
  _getToken = fn
}

// ── Legacy secure storage keys (kept for dual-auth migration) ────────────────
const ACCESS_KEY  = 'chorify.access_token'
const REFRESH_KEY = 'chorify.refresh_token'

const LEGACY_ACCESS_KEY  = 'keptt.access_token'
const LEGACY_REFRESH_KEY = 'keptt.refresh_token'

export async function migrateSecureStoreKeys(): Promise<void> {
  const [legacyAccess, legacyRefresh] = await Promise.all([
    SecureStore.getItemAsync(LEGACY_ACCESS_KEY),
    SecureStore.getItemAsync(LEGACY_REFRESH_KEY),
  ])
  if (!legacyAccess && !legacyRefresh) return

  const [currentAccess, currentRefresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ])

  const writes: Promise<void>[] = []
  if (legacyAccess && !currentAccess) {
    writes.push(SecureStore.setItemAsync(ACCESS_KEY, legacyAccess))
  }
  if (legacyRefresh && !currentRefresh) {
    writes.push(SecureStore.setItemAsync(REFRESH_KEY, legacyRefresh))
  }
  await Promise.all(writes)

  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_ACCESS_KEY),
    SecureStore.deleteItemAsync(LEGACY_REFRESH_KEY),
  ])
  if (__DEV__) console.log('[api] Migrated SecureStore keys from keptt.* to chorify.*')
}

// Legacy token helpers (kept for background fetch and migration period)
export async function getStoredTokens(): Promise<AuthTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ])
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken }
}

export async function storeTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ])
}

export async function storeAccessToken(accessToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken)
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ])
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Get token from Clerk (primary) or fall back to legacy stored tokens
  let token: string | null = null
  if (_getToken) {
    token = await _getToken()
  }
  if (!token) {
    const stored = await getStoredTokens()
    token = stored?.accessToken ?? null
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = `${BASE_URL}${path}`
  if (__DEV__) console.log('API request:', options.method ?? 'GET', url)
  const res = await fetch(url, { ...options, headers })
  if (__DEV__) console.log('API response status:', res.status)

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw { ...body, status: res.status }
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────
// Legacy auth methods kept for dual-auth migration period.

export const auth = {
  async signup(body: SignupRequest): Promise<SignupResponse> {
    return request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  async login(body: LoginRequest): Promise<LoginResponse> {
    const data: LoginResponse = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    await storeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    return data
  },

  async logout(): Promise<void> {
    const stored = await getStoredTokens()
    if (stored) {
      await request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      }).catch(() => {})
    }
    await clearTokens()
  },

  async deleteMe(): Promise<void> {
    await request('/api/auth/me', { method: 'DELETE' })
    await clearTokens()
  },
}

// ── Households ────────────────────────────────────────────────────────────────

export const households = {
  create(body: CreateHouseholdRequest): Promise<{ household: Household; member: Member; accessToken: string }> {
    return request('/api/households', { method: 'POST', body: JSON.stringify(body) })
  },

  join(body: JoinHouseholdRequest): Promise<{ household: Household; member: Member; accessToken: string }> {
    return request('/api/households/join', { method: 'POST', body: JSON.stringify(body) })
  },

  get(id: string): Promise<{ household: Household }> {
    return request(`/api/households/${id}`)
  },

  members(id: string): Promise<{ members: Member[] }> {
    return request(`/api/households/${id}/members`)
  },

  addMember(id: string, body: CreateMemberRequest): Promise<{ member: Member }> {
    return request(`/api/households/${id}/members`, { method: 'POST', body: JSON.stringify(body) })
  },

  tasks(id: string): Promise<{ tasks: Task[] }> {
    return request(`/api/households/${id}/tasks`)
  },

  createTask(id: string, body: CreateTaskRequest): Promise<{ task: Task }> {
    return request(`/api/households/${id}/tasks`, { method: 'POST', body: JSON.stringify(body) })
  },

  deleteAllTasks(id: string): Promise<void> {
    return request(`/api/households/${id}/tasks`, { method: 'DELETE' })
  },

  completions(id: string): Promise<{ completions: Completion[] }> {
    return request(`/api/households/${id}/completions`)
  },

  rooms(id: string): Promise<{ rooms: Room[] }> {
    return request(`/api/households/${id}/rooms`)
  },

  createRoom(id: string, body: CreateRoomRequest): Promise<{ room: Room }> {
    return request(`/api/households/${id}/rooms`, { method: 'POST', body: JSON.stringify(body) })
  },

  categories(id: string): Promise<{ categories: HouseholdCategory[] }> {
    return request(`/api/households/${id}/categories`)
  },

  createCategory(id: string, body: CreateCategoryRequest): Promise<{ category: HouseholdCategory }> {
    return request(`/api/households/${id}/categories`, { method: 'POST', body: JSON.stringify(body) })
  },

  getRewards(id: string): Promise<{ rewards: any[] }> {
    return request(`/api/households/${id}/rewards`)
  },

  createReward(id: string, body: { title: string; pointsRequired: number; emoji: string; assignedTo?: string }): Promise<{ reward: any }> {
    return request(`/api/households/${id}/rewards`, { method: 'POST', body: JSON.stringify(body) })
  },
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

export const rooms = {
  update(id: string, body: UpdateRoomRequest): Promise<{ room: Room }> {
    return request(`/api/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  },

  delete(id: string): Promise<void> {
    return request(`/api/rooms/${id}`, { method: 'DELETE' })
  },
}

// ── Categories ────────────────────────────────────────────────────────────────

export const categoriesApi = {
  update(id: string, body: UpdateCategoryRequest): Promise<{ category: HouseholdCategory }> {
    return request(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  },

  delete(id: string): Promise<void> {
    return request(`/api/categories/${id}`, { method: 'DELETE' })
  },
}

// ── Members ───────────────────────────────────────────────────────────────────

export const members = {
  update(id: string, body: { displayName?: string; emoji?: string; pushToken?: string | null; avatarUrl?: string | null }): Promise<{ member: Member }> {
    return request(`/api/members/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  },
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const tasks = {
  update(id: string, body: UpdateTaskRequest): Promise<{ task: Task }> {
    return request(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  },

  complete(id: string, memberId: string): Promise<TaskCompleteResponse> {
    return request(`/api/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ memberId }),
    })
  },

  delete(id: string): Promise<void> {
    return request(`/api/tasks/${id}`, { method: 'DELETE' })
  },
}
