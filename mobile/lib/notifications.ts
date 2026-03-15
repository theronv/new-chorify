// ── Chorify push notifications + background fetch ─────────────────────────────
// This module is always imported (Metro bundles statically), but all side
// effects and native calls are guarded by IS_EXPO_GO so the app runs cleanly
// in Expo Go. Push notifications require an EAS development build.

import * as BackgroundFetch from 'expo-background-fetch'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import * as TaskManager from 'expo-task-manager'
import { getStoredTokens, households as householdsApi } from '@/lib/api'
import { getTimezone } from '@/lib/timezone'

// ── Environment guard ─────────────────────────────────────────────────────────

/**
 * True when running inside Expo Go (SDK 53+ removed push token support there).
 * False in EAS development builds and standalone/production builds.
 */
export const IS_EXPO_GO = Constants.appOwnership === 'expo'

export const BACKGROUND_FETCH_TASK = 'chorify-background-fetch'

// ── Notification preference ───────────────────────────────────────────────────

export type NotificationPref = 'task' | 'daily' | 'none'

export const NOTIF_PREF_KEY    = 'chorify.notif_pref'
export const DAILY_NOTIF_ID    = 'chorify-daily-summary'
export const PUSH_TOKEN_CACHE_KEY = 'chorify.push_token'

export async function getNotifPref(): Promise<NotificationPref> {
  try {
    const val = await SecureStore.getItemAsync(NOTIF_PREF_KEY)
    if (val === 'task' || val === 'daily' || val === 'none') return val
  } catch {}
  return 'task'
}

export async function saveNotifPref(pref: NotificationPref): Promise<void> {
  await SecureStore.setItemAsync(NOTIF_PREF_KEY, pref)
}

/**
 * Schedule (or reschedule) the daily 8am summary notification.
 * Cancels any existing instance first so only one is ever pending.
 */
export async function scheduleDailySummary(dueCount: number): Promise<void> {
  if (IS_EXPO_GO) return
  await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIF_ID).catch(() => {})
  const body =
    dueCount === 0
      ? 'All caught up — no tasks due today.'
      : `You have ${dueCount} task${dueCount !== 1 ? 's' : ''} due today.`
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_NOTIF_ID,
    content: { title: 'Chorify', body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  })
}

export async function cancelDailySummary(): Promise<void> {
  if (IS_EXPO_GO) return
  await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIF_ID).catch(() => {})
}

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
      const pref = await getNotifPref()

      if (pref === 'none') {
        await Notifications.setBadgeCountAsync(0)
        return BackgroundFetch.BackgroundFetchResult.NoData
      }

      const stored = await getStoredTokens()
      if (!stored) return BackgroundFetch.BackgroundFetchResult.NoData

      const claims      = decodeJwtClaims(stored.accessToken)
      const householdId = claims?.hid
      if (!householdId) return BackgroundFetch.BackgroundFetchResult.NoData

      const [{ tasks }, { completions }, tz] = await Promise.all([
        householdsApi.tasks(householdId),
        householdsApi.completions(householdId),
        getTimezone(),
      ])

      const today    = new Date().toLocaleDateString('en-CA', { timeZone: tz })
      const dueCount = tasks.filter((t) => {
        if (!t.next_due || t.next_due > today) return false
        return !completions.some(
          (c) => c.task_id === t.id && c.completed_date === today,
        )
      }).length

      if (pref === 'daily') {
        await scheduleDailySummary(dueCount)
      }

      await Notifications.setBadgeCountAsync(dueCount)
      if (__DEV__) console.log('[BG] Badge set to', dueCount)
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
