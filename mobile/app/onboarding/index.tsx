import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'

export default function OnboardingIndex() {
  const router = useRouter()
  const { isLandscape } = useLayout()
  // displayName passed from signup, threaded into create/join screens
  const { n } = useLocalSearchParams<{ n?: string }>()

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.header, isLandscape && styles.headerLandscape]}>
          <Text style={styles.emoji}>🏡</Text>
          <Text style={styles.heading}>Set up your household</Text>
          <Text style={styles.sub}>
            Create a new household or join an existing one with an invite code.
          </Text>
        </View>

        {/* Options */}
        <View style={styles.options}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() =>
              router.push({ pathname: '/onboarding/create-household', params: { n: n ?? '' } })
            }
          >
            <Text style={styles.cardEmoji}>✨</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Create a household</Text>
              <Text style={styles.cardDesc}>
                Start fresh and invite your family members.
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() =>
              router.push({ pathname: '/onboarding/join-household', params: { n: n ?? '' } })
            }
          >
            <Text style={styles.cardEmoji}>🔗</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Join a household</Text>
              <Text style={styles.cardDesc}>
                Got an invite code? Join your family's household.
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  emoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  heading: {
    fontFamily: Font.displayBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: Font.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },

  // Option cards
  options: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: Font.semiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  cardDesc: {
    fontFamily: Font.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 24,
    color: Colors.textTertiary,
    marginLeft: 8,
  },

  // Landscape
  headerLandscape: {
    marginBottom: 24,
  },
})
