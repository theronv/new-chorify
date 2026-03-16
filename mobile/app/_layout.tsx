// ── Root layout — loads fonts, hydrates auth, guards routes ──────────────────
// Also imports lib/notifications to register the background task definition
// (must happen on every JS context startup before any background execution).
import { useEffect, useRef } from 'react'
import { Stack, useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { fontMap } from '@/constants/fonts'

// Side-effect import — registers the background task definition and sets the
// foreground notification handler. Must be imported here (root of the app).
import '@/lib/notifications'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const hydrate         = useAuthStore((s) => s.hydrate)
  const isAuthHydrated  = useAuthStore((s) => s.isHydrated)
  const hydrateSettings = useHouseholdStore((s) => s.hydrateSettings)
  const isLoadingSettings = useHouseholdStore((s) => s.isLoadingSettings)
  const router          = useRouter()

  const [fontsLoaded] = useFonts(fontMap)

  // Hydrate auth tokens from SecureStore on first mount
  useEffect(() => {
    Promise.all([hydrate(), hydrateSettings()])
  }, [])

  // Hide splash once fonts + auth + settings are ready
  useEffect(() => {
    if (fontsLoaded && isAuthHydrated && !isLoadingSettings) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, isAuthHydrated, isLoadingSettings])

  // ── Notification tap handler ──────────────────────────────────────────────
  // Fires when the user taps a push notification (app in background or killed).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen
      if (screen === 'today') {
        // Navigate to the Today tab. Router is available because this layout
        // wraps the entire Stack.
        router.push('/(app)/(home)')
      }
    })
    return () => sub.remove()
  }, [])

  if (!fontsLoaded || !isAuthHydrated || isLoadingSettings) return null

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)"       options={{ animation: 'none' }} />
      <Stack.Screen name="(app)"        options={{ animation: 'none' }} />
      <Stack.Screen name="onboarding"   options={{ animation: 'slide_from_right' }} />
    </Stack>
  )
}
