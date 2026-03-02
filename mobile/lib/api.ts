// ── Keptt API client ──────────────────────────────────────────────────────────
// Typed wrapper around the Hono/Vercel Edge API.
// Handles Bearer auth header injection and silent access-token refresh.

import * as SecureStore from 'expo-secure-store'
import type {
  AuthTokens,
  Completion,
  CreateCategoryRequest,
  CreateHouseholdRequest,
  CreateMemberRequest,
  CreateRewardRequest,
  CreateRoomRequest,
  CreateTaskRequest,
  Household,
  HouseholdCategory,
  JoinHouseholdRequest,
  LoginRequest,
  LoginResponse,
  Member,
  Reward,
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
// Set EXPO_PUBLIC_API_URL in mobile/.env.local for development.
// iOS Simulator cannot reach the host machine via `localhost` — use the
// machine's LAN IP instead (e.g. http://192.168.1.X:3000).
// Run: ipconfig getifaddr en0   to find your IP.
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
console.log('[api] BASE_URL:', BASE_URL)

// ── Secure storage keys ───────────────────────────────────────────────────────
const ACCESS_KEY  = 'keptt.access_token'
const REFRESH_KEY = 'keptt.refresh_token'

// ── Token helpers ─────────────────────────────────────────────────────────────

export async function getStoredTokens(): Promise<AuthTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ])
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken }
}

export async function storeTokens(tokens: AuthTokens): Promise<void> {
  if (typeof tokens.accessToken !== 'string') throw new Error(
    'accessToken must be a string, got: ' + typeof tokens.accessToken,
  )
  if (typeof tokens.refreshToken !== 'string') throw new Error(
    'refreshToken must be a string, got: ' + typeof tokens.refreshToken,
  )
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY,  tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ])
}

/** Update only the access token (e.g. after household create/join which doesn't rotate the refresh token). */
export async function storeAccessToken(accessToken: string): Promise<void> {
  if (typeof accessToken !== 'string') throw new Error(
    'accessToken must be a string, got: ' + typeof accessToken,
  )
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken)
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ])
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

let _refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const stored = await getStoredTokens()
  if (!stored) return null

  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
  })
  if (!res.ok) {
    await clearTokens()
    return null
  }
  const data: LoginResponse = await res.json()
  await storeTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
  return data.accessToken
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const stored = await getStoredTokens()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (stored?.accessToken) {
    headers['Authorization'] = `Bearer ${stored.accessToken}`
  }

  const url = `${BASE_URL}${path}`
  console.log('API request:', options.method ?? 'GET', url, options.body ?? '')
  const res = await fetch(url, { ...options, headers })
  console.log('API response status:', res.status)
  console.log('API response body:', await res.clone().text())

  // Silent refresh on 401
  if (res.status === 401 && retry) {
    if (!_refreshPromise) {
      _refreshPromise = refreshAccessToken().finally(() => {
        _refreshPromise = null
      })
    }
    // Capture into a local so .finally() resetting the module var doesn't affect us
    const pending   = _refreshPromise
    const newToken  = await pending
    if (newToken) {
      return request<T>(path, options, false)
    }
    throw { error: 'Session expired', status: 401 }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw { ...body, status: res.status }
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

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

  completions(id: string): Promise<{ completions: Completion[] }> {
    return request(`/api/households/${id}/completions`)
  },

  rewards(id: string): Promise<{ rewards: Reward[] }> {
    return request(`/api/households/${id}/rewards`)
  },

  createReward(id: string, body: CreateRewardRequest): Promise<{ reward: Reward }> {
    return request(`/api/households/${id}/rewards`, { method: 'POST', body: JSON.stringify(body) })
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
  update(id: string, body: { displayName?: string; emoji?: string; pushToken?: string; avatarUrl?: string | null }): Promise<{ member: Member }> {
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
