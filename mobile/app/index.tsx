// ── Entry redirect — send user to the right place ────────────────────────────
import { Redirect } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { useAuthStore } from '@/lib/store'

export default function Index() {
  const { isSignedIn } = useAuth()
  const householdId = useAuthStore((s) => s.householdId)

  if (!isSignedIn)    return <Redirect href="/(auth)/login" />
  if (!householdId)   return <Redirect href="/onboarding" />
  return                      <Redirect href="/(app)/(home)" />
}
