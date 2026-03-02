// ── Keptt push notifications + background fetch ───────────────────────────────
// This module is always imported (Metro bundles statically), but all side
// effects and native calls are guarded by IS_EXPO_GO so the app runs cleanly
// in Expo Go. Push notifications require an EAS development build.

import * as BackgroundFetch from 'expo-background-fetch'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { getStoredTokens, households as householdsApi } from '@/lib/api'

// ── Environment guard ─────────────────────────────────────────────────────────

/**
 * True when running inside Expo Go (SDK 53+ removed push token support there).
 * False in EAS development builds and standalone/production builds.
 */
export const IS_EXPO_GO = Constants.appOwnership === 'expo'

export const BACKGROUND_FETCH_TASK = 'keptt-background-fetch'

// ── Foreground notification handler ──────────────────────────────────────────
// Only configure in builds that support push notifications.

if (!IS_EXPO_GO) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert:  true,
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   true,
    }),
  })
}

// ── Background task ───────────────────────────────────────────────────────────
// defineTask must be called at module level on every JS startup.
// Guard with IS_EXPO_GO so Expo Go never tries to register the task.

function decodeJwtClaims(token: string): { hid?: string | null } | null {
  try {
    const raw = token.split('.')[1]
    return JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

if (!IS_EXPO_GO) {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    try {
      const stored = await getStoredTokens()
      if (!stored) return BackgroundFetch.BackgroundFetchResult.NoData

      const claims      = decodeJwtClaims(stored.accessToken)
      const householdId = claims?.hid
      if (!householdId) return BackgroundFetch.BackgroundFetchResult.NoData

      const [{ tasks }, { completions }] = await Promise.all([
        householdsApi.tasks(householdId),
        householdsApi.completions(householdId),
      ])

      const today = new Date().toISOString().slice(0, 10)
      const overdueCount = tasks.filter((t) => {
        if (!t.next_due || t.next_due > today) return false
        return !completions.some(
          (c) => c.task_id === t.id && c.completed_date === today,
        )
      }).length

      await Notifications.setBadgeCountAsync(overdueCount)
      console.log('[BG] Badge set to', overdueCount)
      return BackgroundFetch.BackgroundFetchResult.NewData
    } catch (e) {
      console.warn('[BG] Background fetch failed:', e)
      return BackgroundFetch.BackgroundFetchResult.Failed
    }
  })
}

// ── Push token registration ───────────────────────────────────────────────────

/**
 * Requests notification permission and returns the Expo push token.
 * Returns null in Expo Go, on simulators, if permission is denied,
 * or if no EAS project ID is configured.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (IS_EXPO_GO) {
    console.log('[Push] Expo Go — push notifications require an EAS dev build')
    return null
  }

  if (!Device.isDevice) {
    console.log('[Push] Simulator — skipping push registration')
    return null
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission denied')
    return null
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId

  if (!projectId) {
    console.warn('[Push] No EAS project ID — add it to app.json under extra.eas.projectId')
    return null
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    console.log('[Push] Token registered:', token)
    return token
  } catch (e) {
    console.warn('[Push] getExpoPushTokenAsync failed:', e)
    return null
  }
}

// ── Background fetch registration ─────────────────────────────────────────────

/**
 * Registers the background fetch task if not already registered.
 * No-op in Expo Go.
 */
export async function registerBackgroundFetch(): Promise<void> {
  if (IS_EXPO_GO) return

  try {
    const status = await BackgroundFetch.getStatusAsync()
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.log('[BG] Background fetch unavailable — status:', status)
      return
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK)
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot:     true,
      })
      console.log('[BG] Background fetch registered')
    }
  } catch (e) {
    console.warn('[BG] Background fetch registration failed:', e)
  }
}
