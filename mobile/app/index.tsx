// ── Entry redirect — send user to the right place ────────────────────────────
import { Redirect } from 'expo-router'
import { useAuthStore } from '@/lib/store'

export default function Index() {
  const householdId = useAuthStore((s) => s.householdId)
  const accessToken = useAuthStore((s) => s.accessToken)

  if (!accessToken)   return <Redirect href="/(auth)/login" />
  if (!householdId)   return <Redirect href="/onboarding" />
  return                      <Redirect href="/(app)/(home)" />
}
