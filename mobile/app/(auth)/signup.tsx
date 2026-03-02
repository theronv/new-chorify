import { useRef, useState } from 'react'
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
import { auth as authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Toast } from '@/components/Toast'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'

export default function SignupScreen() {
  const router    = useRouter()
  const setTokens = useAuthStore((s) => s.setTokens)

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const emailRef    = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  async function handleSignup() {
    const trimmedName  = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedName || !trimmedEmail || password.length < 8) return

    setLoading(true)
    setError(null)
    try {
      // Signup returns tokens directly — no separate login needed
      const data = await authApi.signup({ email: trimmedEmail, password, displayName: trimmedName })
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      router.replace({ pathname: '/onboarding', params: { n: trimmedName } })
    } catch (e: unknown) {
      console.log('Signup error:', JSON.stringify(e, null, 2))
      const message =
        e instanceof Error               ? e.message
        : typeof e === 'string'          ? e
        : typeof (e as any)?.error === 'string' ? (e as any).error
        : 'Sign up failed. Try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().includes('@') &&
    password.length >= 8

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brand}>
            <Text style={styles.brandEmoji}>🏠</Text>
            <Text style={styles.wordmark}>Keptt</Text>
            <Text style={styles.tagline}>Get your household organised</Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create your account</Text>

            <Input
              label="Your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              containerStyle={styles.field}
            />

            <Input
              ref={emailRef}
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
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleSignup}
              containerStyle={styles.field}
            />
            {password.length > 0 && password.length < 8 ? (
              <Text style={styles.hint}>Must be at least 8 characters</Text>
            ) : null}

            <Button
              label="Create Account"
              onPress={handleSignup}
              loading={loading}
              disabled={!canSubmit}
              style={styles.cta}
            />
          </View>

          {/* Switch */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.switchLink}>Log in</Text>
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
    paddingBottom: 32,
    justifyContent: 'center',
  },

  // Brand
  brand: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandEmoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  wordmark: {
    fontFamily: Font.displayBold,
    fontSize: FontSize['3xl'],
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: Font.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontFamily: Font.displaySemiBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  field: {
    marginBottom: 16,
  },
  hint: {
    fontFamily: Font.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 4,
  },
  cta: {
    marginTop: 8,
  },

  // Switch
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
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
})
