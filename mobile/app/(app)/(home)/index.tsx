import { useCallback, useRef, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import ConfettiCannon from 'react-native-confetti-cannon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tasks as tasksApi } from '@/lib/api'
import {
  selectIsCompletedToday,
  useAuthStore,
  useHouseholdStore,
} from '@/lib/store'
import { AddTaskSheet } from '@/components/AddTaskSheet'
import { TaskCard } from '@/components/TaskCard'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import type { Task } from '@/types'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()

  const memberId    = useAuthStore((s) => s.memberId)
  const householdId = useAuthStore((s) => s.householdId)

  const tasks         = useHouseholdStore((s) => s.tasks)
  const completions   = useHouseholdStore((s) => s.completions)
  const members       = useHouseholdStore((s) => s.members)
  const isLoading     = useHouseholdStore((s) => s.isLoading)
  const load          = useHouseholdStore((s) => s.load)
  const addCompletion = useHouseholdStore((s) => s.addCompletion)
  const updateTask    = useHouseholdStore((s) => s.updateTask)
  const updateMember  = useHouseholdStore((s) => s.updateMember)

  const [sheetVisible, setSheetVisible] = useState(false)
  const [completing, setCompleting]     = useState<Record<string, boolean>>({})

  const confettiRef = useRef<any>(null)
  const today       = new Date().toISOString().slice(0, 10)

  // ── Partition tasks into three sections ───────────────────────────────────

  const overdue:   Task[] = []
  const dueToday:  Task[] = []
  const completed: Task[] = []

  for (const task of tasks) {
    if (selectIsCompletedToday(task.id, completions)) {
      completed.push(task)
    } else if (task.next_due === today) {
      dueToday.push(task)
    } else if (task.next_due != null && task.next_due < today) {
      overdue.push(task)
    }
  }

  const hasPending = overdue.length + dueToday.length > 0

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleComplete(task: Task) {
    if (!memberId || completing[task.id]) return
    setCompleting((prev) => ({ ...prev, [task.id]: true }))
    try {
      const res = await tasksApi.complete(task.id, memberId)
      addCompletion({
        id:             res.completion.id,
        task_id:        res.completion.task_id,
        member_id:      res.completion.member_id,
        household_id:   task.household_id,
        completed_date: res.completion.completed_date,
        completed_at:   new Date().toISOString(),
        points:         res.completion.points,
      })
      updateTask(task.id, {
        next_due:       res.nextDue,
        last_completed: res.completion.completed_date,
      })
      updateMember(res.completion.member_id, {
        points_total: res.newPointsTotal,
      })
      confettiRef.current?.start()
    } catch {
      // Card returns to tappable state via finally
    } finally {
      setCompleting((prev) => ({ ...prev, [task.id]: false }))
    }
  }

  const handleRefresh = useCallback(async () => {
    if (householdId) await load(householdId)
  }, [householdId, load])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.screenTitle}>Today</Text>
        <Text style={styles.dateLabel}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      {/* Task list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Overdue */}
        {overdue.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.sectionLabelDanger]}>
              Overdue
            </Text>
            {overdue.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                isCompleted={false}
                isCompleting={!!completing[task.id]}
                onComplete={() => handleComplete(task)}
              />
            ))}
          </View>
        )}

        {/* Due today */}
        {dueToday.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Due Today</Text>
            {dueToday.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                isCompleted={false}
                isCompleting={!!completing[task.id]}
                onComplete={() => handleComplete(task)}
              />
            ))}
          </View>
        )}

        {/* Empty states */}
        {!hasPending && completed.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptyBody}>
              Tap the + button to add your first task.
            </Text>
          </View>
        )}

        {!hasPending && completed.length > 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyBody}>
              Nothing left to do today. Great work!
            </Text>
          </View>
        )}

        {/* Completed today */}
        {completed.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.sectionLabelSuccess]}>
              Completed Today
            </Text>
            {completed.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                isCompleted
                isCompleting={false}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 72 }]}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Confetti — renders off-screen until .start() is called */}
      <ConfettiCannon
        ref={confettiRef}
        count={80}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut
      />

      <AddTaskSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom:     12,
    backgroundColor:   Colors.background,
  },
  screenTitle: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize['3xl'],
    color:      Colors.textPrimary,
  },
  dateLabel: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    marginTop:  2,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop:        4,
  },

  // Section
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily:   Font.semiBold,
    fontSize:     FontSize.xs,
    color:        Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  10,
    marginTop:     16,
  },
  sectionLabelDanger: {
    color: Colors.danger,
  },
  sectionLabelSuccess: {
    color: Colors.success,
  },

  // Empty state
  emptyState: {
    alignItems:    'center',
    justifyContent: 'center',
    paddingTop:    80,
    paddingBottom: 40,
    gap:           8,
  },
  emptyEmoji: {
    fontSize:     52,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize.xl,
    color:      Colors.textPrimary,
  },
  emptyBody: {
    fontFamily: Font.regular,
    fontSize:   FontSize.base,
    color:      Colors.textSecondary,
    textAlign:  'center',
    maxWidth:   240,
  },

  // FAB
  fab: {
    position:        'absolute',
    right:           20,
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     Colors.primary,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    10,
    elevation:       8,
  },
  fabIcon: {
    fontSize:   28,
    lineHeight: 32,
    color:      '#fff',
    fontFamily: Font.regular,
  },
})
