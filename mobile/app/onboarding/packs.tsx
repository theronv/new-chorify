// ── Starter pack selection — runs after creating a new household ──────────────
import { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { households as householdsApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { Button } from '@/components/Button'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import { PACKS } from '@/constants/packs'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PacksScreen() {
  const router      = useRouter()
  const { isLandscape } = useLayout()
  const householdId = useAuthStore((s) => s.householdId)
  const load        = useHouseholdStore((s) => s.load)

  // Only show non-advanced packs during onboarding
  const STARTER_PACKS = PACKS.filter((p) => !p.advanced)

  // Essential is pre-selected by default
  const [selected, setSelected] = useState<Set<string>>(new Set(['essential']))
  const [loading,  setLoading]  = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleStart() {
    if (!householdId) return

    setLoading(true)
    try {
      const tasksToCreate = STARTER_PACKS.filter((p) => selected.has(p.id)).flatMap((p) => p.tasks)

      // Create all tasks concurrently; ignore individual failures
      await Promise.allSettled(
        tasksToCreate.map((t) =>
          householdsApi.createTask(householdId, {
            title:      t.title,
            category:   t.category,
            recurrence: t.recurrence,
          }),
        ),
      )

      // Load fresh household data then enter the app
      await load(householdId)
      router.replace('/(app)/(home)')
    } catch {
      // Even on error, proceed — tasks can be added later
      router.replace('/(app)/(home)')
    } finally {
      setLoading(false)
    }
  }

  const totalTasks = STARTER_PACKS.filter((p) => selected.has(p.id)).reduce(
    (n, p) => n + p.tasks.length,
    0,
  )

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { maxWidth: 480, alignSelf: 'center' as const, width: '100%' as const }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, isLandscape && styles.headerLandscape]}>
          <Text style={styles.heading}>Start with some tasks?</Text>
          <Text style={styles.sub}>
            Pick a starter pack and we'll add tasks to your household automatically.
            You can always add, edit, or remove them later.
          </Text>
        </View>

        {/* Pack cards */}
        <View style={styles.packs}>
          {STARTER_PACKS.map((pack) => {
            const isSelected = selected.has(pack.id)
            return (
              <TouchableOpacity
                key={pack.id}
                activeOpacity={0.8}
                onPress={() => toggle(pack.id)}
                style={[styles.card, isSelected && styles.cardSelected]}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.packEmoji}>{pack.emoji}</Text>
                  <View style={styles.packMeta}>
                    <Text style={styles.packName}>{pack.name}</Text>
                    <Text style={styles.packDesc}>{pack.description}</Text>
                    <Text style={styles.taskCount}>
                      {pack.tasks.length} task{pack.tasks.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={[styles.check, isSelected && styles.checkSelected]}>
                    {isSelected ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Skip link */}
        <TouchableOpacity
          style={styles.skip}
          onPress={() => router.replace('/(app)/(home)')}
        >
          <Text style={styles.skipText}>Skip for now — I'll add tasks manually</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.footer, { maxWidth: 480, alignSelf: 'center' as const, width: '100%' as const }]}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Setting up your household…</Text>
          </View>
        ) : (
          <Button
            label={
              totalTasks > 0
                ? `Add ${totalTasks} task${totalTasks !== 1 ? 's' : ''} & Get Started`
                : 'Get Started'
            }
            onPress={handleStart}
            disabled={loading}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },

  // Header
  header: {
    marginBottom: 28,
  },
  heading: {
    fontFamily: Font.displayBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  sub: {
    fontFamily: Font.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Packs
  packs: {
    gap: 12,
    marginBottom: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packEmoji: {
    fontSize: 36,
    marginRight: 14,
  },
  packMeta: {
    flex: 1,
  },
  packName: {
    fontFamily: Font.semiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  packDesc: {
    fontFamily: Font.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  taskCount: {
    fontFamily: Font.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: 4,
  },

  // Checkbox
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkMark: {
    color: '#fff',
    fontSize: 14,
    fontFamily: Font.bold,
  },

  // Skip
  skip: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: Font.regular,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
  },
  loadingText: {
    fontFamily: Font.medium,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Landscape
  headerLandscape: {
    marginBottom: 16,
  },
})
