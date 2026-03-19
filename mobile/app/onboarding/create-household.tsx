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
import { useSession } from '@clerk/clerk-expo'
import { households as householdsApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Toast } from '@/components/Toast'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'

const EMOJIS = ['😀','😎','🤗','😊','🙂','😄','🧑','👦','👧','👨','👩','🦸','🧙','⭐','🐶','🐱','🦊','🌟','🎮','🏆']

export default function CreateHouseholdScreen() {
  const router    = useRouter()
  const { session } = useSession()
  const clearHousehold = useHouseholdStore((s) => s.clear)

  const { isLandscape } = useLayout()
  const { n } = useLocalSearchParams<{ n?: string }>()

  const [householdName, setHouseholdName] = useState('')
  const [displayName,   setDisplayName]   = useState(n ?? '')
  const [emoji,         setEmoji]         = useState('😀')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  const nameRef = useRef<TextInput>(null)

  async function handleCreate() {
    const hName = householdName.trim()
    const dName = displayName.trim()
    if (!hName || !dName) return

    setLoading(true)
    setError(null)
    try {
      const data = await householdsApi.create({
        name: hName,
        displayName: dName,
        emoji,
      })
      // Reload Clerk session to pick up updated publicMetadata (hid + mid)
      await session?.reload()
      clearHousehold()
      router.replace('/onboarding/packs')
    } catch (e: unknown) {
      const message =
        e instanceof Error               ? e.message
        : typeof e === 'string'          ? e
        : typeof (e as any)?.error === 'string' ? (e as any).error
        : 'Could not create household. Try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = householdName.trim().length > 0 && displayName.trim().length > 0

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { maxWidth: 480, alignSelf: 'center' as const, width: '100%' as const }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.heading}>Create your household</Text>
          <Text style={[styles.sub, isLandscape && styles.subLandscape]}>Give it a name and tell us who you are.</Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Household name"
              placeholder="e.g. The Smith Family"
              value={householdName}
              onChangeText={setHouseholdName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => nameRef.current?.focus()}
              containerStyle={styles.field}
            />

            <Input
              ref={nameRef}
              label="Your name"
              placeholder="e.g. Alex"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
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
            label="Create Household"
            onPress={handleCreate}
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

  form: {
    gap: 0,
  },
  field: {
    marginBottom: 20,
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
  emojiChar: {
    fontSize: 24,
  },

  cta: {},

  // Landscape
  subLandscape: {
    marginBottom: 16,
  },
})
