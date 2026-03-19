// ── Root layout — ClerkProvider, fonts, route guards ─────────────────────────
import { useEffect, useRef } from 'react'
import { Stack, useRouter } from 'expo-router'
import { ClerkProvider, ClerkLoaded, useAuth, useUser } from '@clerk/clerk-expo'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { setTokenGetter } from '@/lib/api'
import { fontMap } from '@/constants/fonts'

// Side-effect import — registers the background task definition and sets the
// foreground notification handler. Must be imported here (root of the app).
import '@/lib/notifications'

SplashScreen.preventAutoHideAsync()

const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

// Clerk token cache backed by SecureStore
const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key)
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value)
  },
  async clearToken(key: string) {
    return SecureStore.deleteItemAsync(key)
  },
}

/**
 * Syncs Clerk auth state into Zustand and registers the token getter
 * so the API client can inject Bearer tokens without React hooks.
 */
function ClerkSync() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const setClerkState = useAuthStore((s) => s.setClerkState)
  const clearAuth     = useAuthStore((s) => s.clearAuth)

  // Register the Clerk token getter for the API client
  useEffect(() => {
    if (isLoaded) {
      setTokenGetter(() => getToken())
    }
  }, [isLoaded, getToken])

  // Sync Clerk user state → Zustand
  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn && user) {
      const meta = user.publicMetadata as { householdId?: string; memberId?: string } | undefined
      setClerkState({
        userId:      user.externalId ?? user.id,
        householdId: meta?.householdId ?? null,
        memberId:    meta?.memberId ?? null,
      })
    } else {
      clearAuth()
      // Mark as hydrated even when signed out so routing can proceed
      useAuthStore.setState({ isHydrated: true })
    }
  }, [isLoaded, isSignedIn, user?.id, user?.externalId, user?.publicMetadata])

  return null
}

export default function RootLayout() {
  const isAuthHydrated    = useAuthStore((s) => s.isHydrated)
  const hydrateSettings   = useHouseholdStore((s) => s.hydrateSettings)
  const isLoadingSettings = useHouseholdStore((s) => s.isLoadingSettings)
  const router            = useRouter()

  const [fontsLoaded] = useFonts(fontMap)

  // Hydrate settings from SecureStore on first mount
  useEffect(() => {
    hydrateSettings()
  }, [])

  // Hide splash once fonts + auth + settings are ready
  useEffect(() => {
    if (fontsLoaded && isAuthHydrated && !isLoadingSettings) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, isAuthHydrated, isLoadingSettings])

  // ── Notification tap handler ──────────────────────────────────────────────
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen
      if (screen === 'today') {
        router.push('/(app)/(home)')
      }
    })
    return () => sub.remove()
  }, [])

  if (!fontsLoaded) return null

  return (
    <ClerkProvider publishableKey={CLERK_KEY} tokenCache={tokenCache}>
      <ClerkLoaded>
        <ClerkSync />
        {isAuthHydrated && !isLoadingSettings ? (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)"       options={{ animation: 'none' }} />
            <Stack.Screen name="(app)"        options={{ animation: 'none' }} />
            <Stack.Screen name="onboarding"   options={{ animation: 'slide_from_right' }} />
          </Stack>
        ) : null}
      </ClerkLoaded>
    </ClerkProvider>
  )
}
