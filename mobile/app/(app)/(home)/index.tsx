import { useCallback, useRef, useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  Pressable,
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
  getTodayString,
  useAuthStore,
  useHouseholdStore,
} from '@/lib/store'
import { AddTaskSheet } from '@/components/AddTaskSheet'
import { EditTaskSheet } from '@/components/EditTaskSheet'
import { TaskCard } from '@/components/TaskCard'
import { Colors, Radius } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import type { Task } from '@/types'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { isTablet, contentPadding, headerPadding, contentMaxWidth } = useLayout()

  const memberId    = useAuthStore((s) => s.memberId)
  const householdId = useAuthStore((s) => s.householdId)

  const tasks         = useHouseholdStore((s) => s.tasks)
  const completions   = useHouseholdStore((s) => s.completions)
  const members       = useHouseholdStore((s) => s.members)
  const rooms         = useHouseholdStore((s) => s.rooms)
  const isLoading     = useHouseholdStore((s) => s.isLoading)
  const load          = useHouseholdStore((s) => s.load)
  const addCompletion = useHouseholdStore((s) => s.addCompletion)
  const updateTask    = useHouseholdStore((s) => s.updateTask)
  const removeTask    = useHouseholdStore((s) => s.removeTask)

  const [sheetVisible,    setSheetVisible]    = useState(false)
  const [editingTask,     setEditingTask]     = useState<Task | null>(null)
  const [completing,      setCompleting]      = useState<Record<string, boolean>>({})
  const [filterRoomId,    setFilterRoomId]    = useState<string | null>(null)
  const [roomPickerOpen,  setRoomPickerOpen]  = useState(false)

  const confettiRef = useRef<any>(null)
  const today       = getTodayString()

  // ── Filter + partition tasks into three sections ──────────────────────────

  const activeRoom = filterRoomId ? rooms.find((r) => r.id === filterRoomId) ?? null : null

  const visibleTasks = filterRoomId
    ? tasks.filter((t) => t.room_id === filterRoomId)
    : tasks

  const overdue:   Task[] = []
  const dueToday:  Task[] = []
  const completed: Task[] = []

  for (const task of visibleTasks) {
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

  function handleComplete(task: Task) {
    if (!memberId || completing[task.id]) return
    Alert.alert(
      'Mark as done?',
      task.title,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete ✓',
          onPress: async () => {
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
              })
              updateTask(task.id, {
                next_due:       res.nextDue,
                last_completed: res.completion.completed_date,
              })
              confettiRef.current?.start()
            } catch {
              // Checkbox returns to tappable state via finally
            } finally {
              setCompleting((prev) => ({ ...prev, [task.id]: false }))
            }
          },
        },
      ],
    )
  }

  async function handleDelete(task: Task) {
    try {
      await tasksApi.delete(task.id)
      removeTask(task.id)
    } catch {
      // Task card has already animated off; silently ignore the error
    }
  }

  const handleRefresh = useCallback(async () => {
    if (householdId) await load(householdId)
  }, [householdId, load])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingLeft: headerPadding + insets.left, paddingRight: headerPadding + insets.right }]}>
        <View style={styles.headerTop}>
          <View style={styles.titleRow}>
            <Image source={require('@/assets/icon.png')} style={styles.logo} />
            <View>
              <Text style={styles.screenTitle}>Today</Text>
              <Text style={styles.dateLabel}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setSheetVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnIcon}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Room filter — only shown when at least one room exists */}
        {rooms.length > 0 && (
          <TouchableOpacity
            style={[styles.filterBtn, activeRoom && styles.filterBtnActive]}
            onPress={() => setRoomPickerOpen(true)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterBtnText, activeRoom && styles.filterBtnTextActive]}>
              {activeRoom ? `${activeRoom.emoji} ${activeRoom.name}` : '🏠 All Rooms'}
            </Text>
            <Text style={[styles.filterChevron, activeRoom && styles.filterBtnTextActive]}>▾</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Room filter picker modal */}
      <Modal
        visible={roomPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRoomPickerOpen(false)}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.pickerBackdrop]}
          onPress={() => setRoomPickerOpen(false)}
        />
        <View style={styles.pickerWrapper} pointerEvents="box-none">
          <View style={[styles.pickerPopup, isTablet && { maxWidth: 420 }]}>
            <Text style={styles.pickerTitle}>Filter by Room</Text>

            {/* All Rooms */}
            <TouchableOpacity
              style={[styles.pickerOption, filterRoomId === null && styles.pickerOptionSelected]}
              onPress={() => { setFilterRoomId(null); setRoomPickerOpen(false) }}
              activeOpacity={0.65}
            >
              <Text style={styles.pickerOptionEmoji}>🏠</Text>
              <Text style={[styles.pickerOptionLabel, filterRoomId === null && styles.pickerOptionLabelSelected]}>
                All Rooms
              </Text>
              {filterRoomId === null && <Text style={styles.pickerCheck}>✓</Text>}
            </TouchableOpacity>

            {rooms.map((room) => {
              const selected = filterRoomId === room.id
              return (
                <TouchableOpacity
                  key={room.id}
                  style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                  onPress={() => { setFilterRoomId(room.id); setRoomPickerOpen(false) }}
                  activeOpacity={0.65}
                >
                  <Text style={styles.pickerOptionEmoji}>{room.emoji}</Text>
                  <Text style={[styles.pickerOptionLabel, selected && styles.pickerOptionLabelSelected]}>
                    {room.name}
                  </Text>
                  {selected && <Text style={styles.pickerCheck}>✓</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </Modal>

      {/* Task list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 24,
            paddingLeft:   contentPadding + insets.left,
            paddingRight:  contentPadding + insets.right,
            maxWidth:      contentMaxWidth,
            alignSelf:     contentMaxWidth ? 'center' : undefined,
            width:         contentMaxWidth ? '100%' : undefined,
          },
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
                rooms={rooms}
                isCompleting={!!completing[task.id]}
                onComplete={() => handleComplete(task)}
                onDelete={() => handleDelete(task)}
                onLongPress={() => setEditingTask(task)}
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
                rooms={rooms}
                isCompleting={!!completing[task.id]}
                onComplete={() => handleComplete(task)}
                onDelete={() => handleDelete(task)}
                onLongPress={() => setEditingTask(task)}
              />
            ))}
          </View>
        )}

        {/* Empty states */}
        {!hasPending && completed.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{activeRoom ? activeRoom.emoji : '📋'}</Text>
            <Text style={styles.emptyTitle}>
              {activeRoom ? `No tasks in ${activeRoom.name}` : 'No tasks yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {activeRoom
                ? 'No tasks are due here today.'
                : 'Tap the + button to add your first task.'}
            </Text>
          </View>
        )}

        {!hasPending && completed.length > 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyBody}>
              {activeRoom
                ? `Nothing left to do in ${activeRoom.name} today.`
                : 'Nothing left to do today. Great work!'}
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
                rooms={rooms}
                isCompleted
                isCompleting={false}
                onDelete={() => handleDelete(task)}
                onLongPress={() => setEditingTask(task)}
              />
            ))}
          </View>
        )}
      </ScrollView>

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

      <EditTaskSheet
        task={editingTask}
        visible={editingTask !== null}
        onClose={() => setEditingTask(null)}
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

  // Room filter button
  filterBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    gap:               6,
    marginTop:         10,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      Radius.full,
    backgroundColor:   Colors.borderSubtle,
    borderWidth:       1.5,
    borderColor:       Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primaryLight,
    borderColor:     Colors.primary,
  },
  filterBtnText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  filterBtnTextActive: {
    color: Colors.primary,
  },
  filterChevron: {
    fontFamily: Font.regular,
    fontSize:   12,
    color:      Colors.textSecondary,
  },

  // Room picker modal
  pickerBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerWrapper: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
  },
  pickerPopup: {
    width:           '100%',
    backgroundColor: Colors.surface,
    borderRadius:    Radius.xl,
    paddingVertical: 8,
    shadowColor:     Colors.textPrimary,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.15,
    shadowRadius:    24,
    elevation:       16,
  },
  pickerTitle: {
    fontFamily:        Font.semiBold,
    fontSize:          FontSize.sm,
    color:             Colors.textSecondary,
    textTransform:     'uppercase',
    letterSpacing:     0.8,
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  pickerOption: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   13,
    borderRadius:      Radius.md,
    marginHorizontal:  6,
  },
  pickerOptionSelected: {
    backgroundColor: Colors.primaryLight,
  },
  pickerOptionEmoji: {
    fontSize: 20,
  },
  pickerOptionLabel: {
    flex:       1,
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
  },
  pickerOptionLabelSelected: {
    color: Colors.primary,
  },
  pickerCheck: {
    fontFamily: Font.bold,
    fontSize:   FontSize.base,
    color:      Colors.primary,
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

  // Header top row
  headerTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  logo: {
    width:  36,
    height: 36,
  },

  // Add button (in header)
  addBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       4,
    shadowColor:     Colors.primary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.3,
    shadowRadius:    6,
    elevation:       4,
  },
  addBtnIcon: {
    fontSize:   26,
    lineHeight: 30,
    color:      Colors.textOnPrimary,
    fontFamily: Font.regular,
  },
})
