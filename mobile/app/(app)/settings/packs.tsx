// ── Browse & add chore packs from Settings ────────────────────────────────────
import { useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { households as householdsApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { Button } from '@/components/Button'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import { PACKS } from '@/constants/packs'
import type { Pack } from '@/constants/packs'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns how many tasks in a pack are NOT already in the household (by title). */
function newTasksInPack(pack: Pack, existingTitles: Set<string>): number {
  return pack.tasks.filter((t) => !existingTitles.has(t.title.toLowerCase())).length
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PacksSettingsScreen() {
  const insets      = useSafeAreaInsets()
  const router      = useRouter()
  const { contentPadding, headerPadding, contentMaxWidth } = useLayout()
  const householdId = useAuthStore((s) => s.householdId)
  const tasks       = useHouseholdStore((s) => s.tasks)
  const addTask     = useHouseholdStore((s) => s.addTask)

  // Build a set of existing task titles for O(1) dedup lookups
  const existingTitles = new Set(tasks.map((t) => t.title.toLowerCase()))

  const [adding, setAdding] = useState<string | null>(null) // pack id being added

  async function handleAddPack(pack: Pack) {
    if (!householdId) return

    const newTasks = pack.tasks.filter((t) => !existingTitles.has(t.title.toLowerCase()))
    if (newTasks.length === 0) return

    setAdding(pack.id)
    try {
      const results = await Promise.allSettled(
        newTasks.map((t) =>
          householdsApi.createTask(householdId, {
            title:      t.title,
            category:   t.category,
            recurrence: t.recurrence,
            points:     t.points,
          }),
        ),
      )

      // Add successful tasks to the store
      for (const r of results) {
        if (r.status === 'fulfilled') {
          addTask(r.value.task)
        }
      }

      const added = results.filter((r) => r.status === 'fulfilled').length
      Alert.alert(
        'Pack added',
        `Added ${added} task${added !== 1 ? 's' : ''} from ${pack.name}.`,
      )
    } catch {
      Alert.alert('Error', 'Could not add pack tasks. Please try again.')
    } finally {
      setAdding(null)
    }
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingLeft: headerPadding + insets.left, paddingRight: headerPadding + insets.right }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Browse Packs</Text>
        <Text style={styles.screenSub}>
          Add curated task sets to your household in one tap.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 32,
            paddingLeft:   contentPadding + insets.left,
            paddingRight:  contentPadding + insets.right,
            maxWidth:      contentMaxWidth,
            alignSelf:     contentMaxWidth ? 'center' : undefined,
            width:         contentMaxWidth ? '100%' : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {PACKS.map((pack) => {
          const newCount  = newTasksInPack(pack, existingTitles)
          const allAdded  = newCount === 0
          const isAdding  = adding === pack.id

          return (
            <View key={pack.id} style={[styles.card, allAdded && styles.cardDim]}>
              {/* Pack header row */}
              <View style={styles.packTop}>
                <Text style={styles.packEmoji}>{pack.emoji}</Text>
                <View style={styles.packMeta}>
                  <View style={styles.packNameRow}>
                    <Text style={styles.packName}>{pack.name}</Text>
                    {pack.advanced && (
                      <View style={styles.advancedBadge}>
                        <Text style={styles.advancedBadgeText}>Advanced</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.packDesc}>{pack.description}</Text>
                </View>
              </View>

              {/* Task list */}
              <View style={styles.taskList}>
                {pack.tasks.map((task) => {
                  const alreadyAdded = existingTitles.has(task.title.toLowerCase())
                  return (
                    <View key={task.title} style={styles.taskRow}>
                      <Text
                        style={[styles.taskTitle, alreadyAdded && styles.taskTitleDim]}
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>
                      <View style={styles.taskRight}>
                        <Text style={[styles.taskPts, alreadyAdded && styles.taskPtsDim]}>
                          {task.points} pts
                        </Text>
                        {alreadyAdded && (
                          <View style={styles.addedBadge}>
                            <Text style={styles.addedBadgeText}>Added</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )
                })}
              </View>

              {/* Add button */}
              <View style={styles.cardFooter}>
                {allAdded ? (
                  <View style={styles.allAddedRow}>
                    <Text style={styles.allAddedText}>✓ All tasks already in your household</Text>
                  </View>
                ) : (
                  <Button
                    label={
                      isAdding
                        ? 'Adding…'
                        : `Add ${newCount} task${newCount !== 1 ? 's' : ''}`
                    }
                    onPress={() => handleAddPack(pack)}
                    disabled={isAdding || !!adding}
                    loading={isAdding}
                  />
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    paddingHorizontal: 20,
    paddingBottom:     16,
    backgroundColor:   Colors.background,
  },
  backBtn: {
    marginBottom: 8,
  },
  backText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.primary,
  },
  screenTitle: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize['3xl'],
    color:      Colors.textPrimary,
    marginBottom: 4,
  },
  screenSub: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    lineHeight: 20,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },

  // Pack card
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    18,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },
  cardDim: {
    opacity: 0.7,
  },
  packTop: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    padding:       16,
    paddingBottom: 12,
    gap:           12,
  },
  packEmoji: {
    fontSize:   34,
    lineHeight: 40,
  },
  packMeta: {
    flex: 1,
    gap:  4,
  },
  packNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    flexWrap:      'wrap',
  },
  packName: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.md,
    color:      Colors.textPrimary,
  },
  advancedBadge: {
    backgroundColor:   Colors.goldLight,
    borderRadius:      6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  advancedBadgeText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.xs,
    color:      Colors.textOnGold,
  },
  packDesc: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },

  // Task list
  taskList: {
    borderTopWidth:  StyleSheet.hairlineWidth,
    borderTopColor:  Colors.border,
    paddingVertical: 4,
  },
  taskRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  taskTitle: {
    flex:       1,
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textPrimary,
  },
  taskTitleDim: {
    color: Colors.textTertiary,
  },
  taskRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginLeft:    8,
  },
  taskPts: {
    fontFamily: Font.medium,
    fontSize:   FontSize.xs,
    color:      Colors.primary,
  },
  taskPtsDim: {
    color: Colors.textTertiary,
  },
  addedBadge: {
    backgroundColor:   Colors.successLight,
    borderRadius:      6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  addedBadgeText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.xs,
    color:      Colors.success,
  },

  // Card footer
  cardFooter: {
    padding: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  allAddedRow: {
    alignItems:    'center',
    paddingVertical: 10,
  },
  allAddedText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.success,
  },
})
