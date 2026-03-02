import { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { members as membersApi } from '@/lib/api'
import {
  registerForPushNotificationsAsync,
  registerBackgroundFetch,
} from '@/lib/notifications'
import { Colors } from '@/constants/colors'
import { Font } from '@/constants/fonts'

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
  const members      = useHouseholdStore((s) => s.members)
  const updateMember = useHouseholdStore((s) => s.updateMember)

  // Load household data on mount
  useEffect(() => {
    if (householdId) load(householdId)
  }, [householdId])

  // Register push token + background fetch once member data is available
  useEffect(() => {
    if (!memberId) return

    async function setup() {
      const token = await registerForPushNotificationsAsync()

      if (token && memberId) {
        // Only PATCH the server if the token has changed
        const me = members.find((m) => m.id === memberId)
        if (token !== me?.push_token) {
          try {
            await membersApi.update(memberId, { pushToken: token })
            updateMember(memberId, { push_token: token })
            console.log('[Push] Token updated on server')
          } catch (e) {
            console.warn('[Push] Failed to update token on server:', e)
          }
        } else {
          console.log('[Push] Token unchanged — skipping PATCH')
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
          borderTopColor:  Colors.border,
          borderTopWidth:  1,
        },
        tabBarLabelStyle: {
          fontFamily: Font.medium,
          fontSize: 11,
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
          title:      'Family',
          tabBarIcon: tabIcon('people-outline', 'people'),
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title:      'Rewards',
          tabBarIcon: tabIcon('gift-outline', 'gift'),
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
