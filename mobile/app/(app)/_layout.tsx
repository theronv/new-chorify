import { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { useAuthStore, useHouseholdStore, setStoreTimezone, selectTodaysTasks, selectIsCompletedToday } from '@/lib/store'
import { members as membersApi } from '@/lib/api'
import { getTimezone } from '@/lib/timezone'
import {
  IS_EXPO_GO,
  getNotifPref,
  registerForPushNotificationsAsync,
  registerBackgroundFetch,
  scheduleDailySummary,
  cancelDailySummary,
  PUSH_TOKEN_CACHE_KEY,
} from '@/lib/notifications'
import { Colors, Shadows } from '@/constants/colors'
import { Font } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(name: IoniconName, focusedName: IoniconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={24} color={color} />
  )
}

export default function AppLayout() {
  const householdId  = useAuthStore((s) => s.householdId)
  const memberId     = useAuthStore((s) => s.memberId)
  const load         = useHouseholdStore((s) => s.load)
  const updateMember = useHouseholdStore((s) => s.updateMember)
  const { isTablet } = useLayout()

  // Load timezone preference once on mount
  useEffect(() => { getTimezone().then(setStoreTimezone) }, [])

  // Keep the app badge in sync with due (uncompleted) task count
  const tasks       = useHouseholdStore((s) => s.tasks)
  const completions = useHouseholdStore((s) => s.completions)
  useEffect(() => {
    if (!IS_EXPO_GO) {
      const dueTasks  = selectTodaysTasks(tasks)
      const dueCount  = dueTasks.filter((t) => !selectIsCompletedToday(t.id, completions)).length
      Notifications.setBadgeCountAsync(dueCount).catch(() => {})
    }
  }, [tasks, completions])

  // Load household data on mount
  useEffect(() => {
    if (householdId) load(householdId)
  }, [householdId])

  // Register push token + background fetch once authenticated
  useEffect(() => {
    if (!memberId) return

    async function setup() {
      const pref = await getNotifPref()

      if (pref === 'task') {
        const token = await registerForPushNotificationsAsync()
        if (token && memberId) {
          const cached = await SecureStore.getItemAsync(PUSH_TOKEN_CACHE_KEY)
          if (token !== cached) {
            try {
              await membersApi.update(memberId, { pushToken: token })
              await SecureStore.setItemAsync(PUSH_TOKEN_CACHE_KEY, token)
              updateMember(memberId, { push_token: token })
              if (__DEV__) console.log('[Push] Token updated on server')
            } catch (e) {
              if (__DEV__) console.warn('[Push] Failed to update token on server:', e)
            }
          } else {
            if (__DEV__) console.log('[Push] Token unchanged — skipping PATCH')
          }
        }
      } else {
        // Ensure no stale push token is left on the server
        const cached = await SecureStore.getItemAsync(PUSH_TOKEN_CACHE_KEY)
        if (cached && memberId) {
          try {
            await membersApi.update(memberId, { pushToken: null })
            await SecureStore.deleteItemAsync(PUSH_TOKEN_CACHE_KEY)
            updateMember(memberId, { push_token: null })
          } catch {}
        }
        if (pref === 'daily') {
          await scheduleDailySummary(0) // background fetch will update the count
        } else {
          await cancelDailySummary()
        }
      }

      await registerBackgroundFetch()
    }

    setup()
  }, [memberId])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBackground,
          borderTopWidth:  0,
          shadowColor:     Colors.textPrimary,
          shadowOffset:    { width: 0, height: -3 },
          shadowOpacity:   0.08,
          shadowRadius:    12,
          elevation:       8,
        },
        tabBarLabelStyle: {
          fontFamily: Font.medium,
          fontSize: isTablet ? 13 : 11,
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title:      'Today',
          tabBarIcon: tabIcon('calendar-outline', 'calendar'),
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title:      'Tasks',
          tabBarIcon: tabIcon('list-outline', 'list'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title:      'Settings',
          tabBarIcon: tabIcon('settings-outline', 'settings'),
        }}
      />
    </Tabs>
  )
}
