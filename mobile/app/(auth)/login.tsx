import { useCallback, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useSignIn, useSSO } from '@clerk/clerk-expo'
import * as WebBrowser from 'expo-web-browser'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Toast } from '@/components/Toast'
import { Colors, Radius, Shadows } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'

// Warm up the browser for OAuth redirects
WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const router = useRouter()
  const { signIn, setActive, isLoaded } = useSignIn()
  const { startSSOFlow } = useSSO()
  const { isLandscape } = useLayout()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const passwordRef = useRef<TextInput>(null)

  async function handleLogin() {
    if (!isLoaded || !signIn) return
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) return

    setLoading(true)
    setError(null)
    try {
      const result = await signIn.create({
        identifier: trimmedEmail,
        password,
      })

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        router.replace('/')
      }
    } catch (e: any) {
      const message = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? 'Login failed. Check your email and password.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = useCallback(async () => {
    if (googleLoading) return
    setGoogleLoading(true)
    setError(null)
    try {
      const { createdSessionId, setActive: setActiveSession } = await startSSOFlow({
        strategy: 'oauth_google',
      })

      if (createdSessionId && setActiveSession) {
        await setActiveSession({ session: createdSessionId })
        router.replace('/')
      }
    } catch (e: any) {
      const message = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? 'Google sign-in failed. Try again.'
      setError(message)
    } finally {
      setGoogleLoading(false)
    }
  }, [googleLoading, startSSOFlow, router])

  const canSubmit = email.trim().length > 0 && password.length > 0

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { maxWidth: 480, alignSelf: 'center', width: '100%' }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={[styles.brand, isLandscape && styles.brandLandscape]}>
            <View style={styles.logoBadge}>
              <Text style={styles.brandEmoji}>🏠</Text>
            </View>
            <Text style={styles.wordmark}>Chorify</Text>
            <Text style={styles.tagline}>Your family's task tracker</Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>

            {/* Google Sign-In */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.googleBtnText}>
                {googleLoading ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              containerStyle={styles.field}
            />

            <Input
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              containerStyle={styles.field}
            />

            <Button
              label="Sign In"
              onPress={handleLogin}
              loading={loading}
              disabled={!canSubmit}
              style={styles.cta}
            />
          </View>

          {/* Switch */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/signup')}>
              <Text style={styles.switchLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        message={error ?? ''}
        type="error"
        visible={error !== null}
        onHide={() => setError(null)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },

  // Brand
  brand: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Shadows.button,
  },
  brandEmoji: {
    fontSize: 34,
  },
  wordmark: {
    fontFamily: Font.displayBold,
    fontSize: FontSize['3xl'],
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: Font.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 6,
    letterSpacing: 0.1,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 28,
    ...Shadows.card,
  },
  cardTitle: {
    fontFamily: Font.displaySemiBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  cta: {
    marginTop: 8,
  },

  // Google button
  googleBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    fontFamily: Font.semiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderSubtle,
  },
  dividerText: {
    fontFamily: Font.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    marginHorizontal: 16,
  },

  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  switchText: {
    fontFamily: Font.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  switchLink: {
    fontFamily: Font.semiBold,
    fontSize: FontSize.base,
    color: Colors.primary,
  },

  // Landscape
  brandLandscape: {
    marginBottom: 20,
  },
})
