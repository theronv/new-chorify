import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { households as householdsApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Toast } from '@/components/Toast'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'

const EMOJIS = ['😀','😎','🤗','😊','🙂','😄','🧑','👦','👧','👨','👩','🦸','🧙','⭐','🐶','🐱','🦊','🌟','🎮','🏆']

export default function JoinHouseholdScreen() {
  const router         = useRouter()
  const updateAccessToken = useAuthStore((s) => s.updateAccessToken)
  const loadHousehold     = useHouseholdStore((s) => s.load)

  const { n } = useLocalSearchParams<{ n?: string }>()

  const [inviteCode,   setInviteCode]   = useState('')
  const [displayName,  setDisplayName]  = useState(n ?? '')
  const [emoji,        setEmoji]        = useState('😀')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const nameRef = useRef<TextInput>(null)

  async function handleJoin() {
    const code  = inviteCode.trim().toUpperCase()
    const dName = displayName.trim()
    if (code.length !== 6 || !dName) return

    setLoading(true)
    setError(null)
    try {
      const data = await householdsApi.join({
        inviteCode: code,
        displayName: dName,
        emoji,
      })
      // Server issues a new access token carrying hid + mid; refresh token is unchanged
      await updateAccessToken(data.accessToken)
      await loadHousehold(data.household.id)
      router.replace('/(app)/(home)')
    } catch (e: unknown) {
      const message =
        e instanceof Error               ? e.message
        : typeof e === 'string'          ? e
        : typeof (e as any)?.error === 'string' ? (e as any).error
        : 'Invalid invite code. Check and try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = inviteCode.trim().length === 6 && displayName.trim().length > 0

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
          {/* Back */}
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.heading}>Join a household</Text>
          <Text style={styles.sub}>
            Enter the 6-character invite code from your household admin.
          </Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Invite code"
              placeholder="ABC123"
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="next"
              onSubmitEditing={() => nameRef.current?.focus()}
              containerStyle={styles.field}
              style={styles.codeInput}
            />

            <Input
              ref={nameRef}
              label="Your name"
              placeholder="e.g. Alex"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleJoin}
              containerStyle={styles.field}
            />

            {/* Emoji picker */}
            <Text style={styles.emojiLabel}>Your avatar</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiRow}
            >
              {EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[styles.emojiBtn, emoji === e && styles.emojiBtnSelected]}
                >
                  <Text style={styles.emojiChar}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Button
            label="Join Household"
            onPress={handleJoin}
            loading={loading}
            disabled={!canSubmit}
            style={styles.cta}
          />
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
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
  },

  back: { marginBottom: 24 },
  backText: {
    fontFamily: Font.medium,
    fontSize: FontSize.base,
    color: Colors.primary,
  },

  heading: {
    fontFamily: Font.displayBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  sub: {
    fontFamily: Font.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginBottom: 32,
    lineHeight: 22,
  },

  form: {},
  field: { marginBottom: 20 },

  // Code input is bigger + centered
  codeInput: {
    fontSize: FontSize.xl,
    fontFamily: Font.bold,
    letterSpacing: 8,
    textAlign: 'center',
  },

  // Emoji picker
  emojiLabel: {
    fontFamily: Font.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    marginBottom: 32,
  },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnSelected: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  emojiChar: { fontSize: 24 },

  cta: {},
})
