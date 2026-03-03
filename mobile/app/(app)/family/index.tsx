import { useCallback, useRef, useState } from 'react'
import {
  Alert,
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
  getWeekFromNowString,
  useAuthStore,
  useHouseholdStore,
} from '@/lib/store'
import { AddTaskSheet } from '@/components/AddTaskSheet'
import { EditTaskSheet } from '@/components/EditTaskSheet'
import { MemberAvatar } from '@/components/MemberAvatar'
import { TaskCard } from '@/components/TaskCard'
import { Colors, Radius } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import type { Task, Completion } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function weeklyCompletions(memberId: string, completions: Completion[]): number {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return completions.filter(
    (c) => c.member_id === memberId && c.completed_date >= cutoffStr,
  ).length
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TasksScreen() {
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

  // Task sheet state
  const [sheetVisible, setSheetVisible]   = useState(false)
  const [editingTask, setEditingTask]     = useState<Task | null>(null)
  const [completing, setCompleting]       = useState<Record<string, boolean>>({})

  // Filter state
  const [filterRoomId, setFilterRoomId]       = useState<string | null>(null)
  const [filterMemberId, setFilterMemberId]   = useState<string | null>(null)
  const [roomPickerOpen, setRoomPickerOpen]   = useState(false)
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)

  const confettiRef = useRef<any>(null)

  const today   = getTodayString()
  const weekStr = getWeekFromNowString()

  // ── Leaderboard ─────────────────────────────────────────────────────────────

  const sorted = [...members].sort(
    (a, b) => weeklyCompletions(b.id, completions) - weeklyCompletions(a.id, completions),
  )

  // ── Filter + partition tasks ─────────────────────────────────────────────────

  const activeRoom   = filterRoomId   ? rooms.find((r) => r.id === filterRoomId)     ?? null : null
  const activeMember = filterMemberId ? members.find((m) => m.id === filterMemberId) ?? null : null

  const visibleTasks = tasks.filter((t) => {
    if (filterRoomId   && t.room_id     !== filterRoomId)   return false
    if (filterMemberId && t.assigned_to !== filterMemberId) return false
    return true
  })

  const overdue:   Task[] = []
  const dueToday:  Task[] = []
  const upcoming:  Task[] = []
  const later:     Task[] = []
  const anytime:   Task[] = []
  const completed: Task[] = []

  for (const task of visibleTasks) {
    const isCompleted = selectIsCompletedToday(task.id, completions)
    if (isCompleted) {
      completed.push(task)
    } else if (task.next_due === null) {
      anytime.push(task)
    } else if (task.next_due < today) {
      overdue.push(task)
    } else if (task.next_due === today) {
      dueToday.push(task)
    } else if (task.next_due <= weekStr) {
      upcoming.push(task)
    } else {
      later.push(task)
    }
  }

  const hasAnySection =
    overdue.length + dueToday.length + upcoming.length + later.length + anytime.length + completed.length > 0

  // ── Handlers ────────────────────────────────────────────────────────────────

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
      // Task card has already animated off; silently ignore
    }
  }

  const handleRefresh = useCallback(async () => {
    if (householdId) await load(householdId)
  }, [householdId, load])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingLeft: headerPadding + insets.left, paddingRight: headerPadding + insets.right }]}>
        <View style={styles.headerTop}>
          <Text style={styles.screenTitle}>Tasks</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setSheetVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnIcon}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main scroll */}
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

        {/* ── This Week leaderboard ─────────────────────────────────────────── */}
        <View style={styles.weekSection}>
          <Text style={styles.weekLabel}>This Week</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.leaderRow}
          >
            {sorted.map((member, i) => {
              const wCount = weeklyCompletions(member.id, completions)
              const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              return (
                <View key={member.id} style={styles.leaderCard}>
                  <Text style={styles.leaderRank}>{medal ?? `#${i + 1}`}</Text>
                  <MemberAvatar member={member} size={36} />
                  <Text style={styles.leaderName} numberOfLines={1}>
                    {member.display_name}
                  </Text>
                  <Text style={styles.leaderCount}>
                    {wCount} {wCount === 1 ? 'task' : 'tasks'}
                  </Text>
                </View>
              )
            })}

          </ScrollView>
        </View>

        {/* ── Filter pills ─────────────────────────────────────────────────── */}
        <View style={styles.filterRow}>
          {/* All */}
          <TouchableOpacity
            style={[styles.pill, !filterRoomId && !filterMemberId && styles.pillActive]}
            onPress={() => { setFilterRoomId(null); setFilterMemberId(null) }}
            activeOpacity={0.75}
          >
            <Text style={[styles.pillText, !filterRoomId && !filterMemberId && styles.pillTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          {/* Room */}
          {rooms.length > 0 && (
            <TouchableOpacity
              style={[styles.pill, !!filterRoomId && styles.pillActive]}
              onPress={() => setRoomPickerOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillText, !!filterRoomId && styles.pillTextActive]}>
                {activeRoom ? `${activeRoom.emoji} ${activeRoom.name}` : 'Room'} ▾
              </Text>
            </TouchableOpacity>
          )}

          {/* Member */}
          {members.length > 1 && (
            <TouchableOpacity
              style={[styles.pill, !!filterMemberId && styles.pillActive]}
              onPress={() => setMemberPickerOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillText, !!filterMemberId && styles.pillTextActive]}>
                {activeMember ? `${activeMember.emoji} ${activeMember.display_name}` : 'Member'} ▾
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Task sections ─────────────────────────────────────────────────── */}

        {/* Overdue */}
        {overdue.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.sectionLabelDanger]}>Overdue</Text>
            {overdue.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                rooms={rooms}
                isCompleted={false}
                isCompleting={!!completing[task.id]}
                onComplete={() => handleComplete(task)}
                onDelete={() => handleDelete(task)}
                onLongPress={() => setEditingTask(task)}
              />
            ))}
          </View>
        )}

        {/* Due Today */}
        {dueToday.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.sectionLabelWarning]}>Due Today</Text>
            {dueToday.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                rooms={rooms}
                isCompleted={false}
                isCompleting={!!completing[task.id]}
                onComplete={() => handleComplete(task)}
                onDelete={() => handleDelete(task)}
                onLongPress={() => setEditingTask(task)}
              />
            ))}
          </View>
        )}

        {/* Upcoming (7 days) */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Upcoming (7 days)</Text>
            {upcoming.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                rooms={rooms}
                isCompleted={false}
                isCompleting={!!completing[task.id]}
                onComplete={() => handleComplete(task)}
                onDelete={() => handleDelete(task)}
                onLongPress={() => setEditingTask(task)}
              />
            ))}
          </View>
        )}

        {/* Later */}
        {later.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Later</Text>
            {later.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                rooms={rooms}
                isCompleted={false}
                isCompleting={!!completing[task.id]}
                onComplete={() => handleComplete(task)}
                onDelete={() => handleDelete(task)}
                onLongPress={() => setEditingTask(task)}
              />
            ))}
          </View>
        )}

        {/* No Date */}
        {anytime.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>No Date</Text>
            {anytime.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                members={members}
                rooms={rooms}
                isCompleted={false}
                isCompleting={!!completing[task.id]}
                onComplete={() => handleComplete(task)}
                onDelete={() => handleDelete(task)}
                onLongPress={() => setEditingTask(task)}
              />
            ))}
          </View>
        )}

        {/* Completed Today */}
        {completed.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, styles.sectionLabelSuccess]}>Completed Today</Text>
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

        {/* Empty states */}
        {tasks.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptyBody}>Tap + to add your first task</Text>
          </View>
        )}

        {tasks.length > 0 && !hasAnySection && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>No matching tasks</Text>
            <Text style={styles.emptyBody}>No tasks match this filter</Text>
          </View>
        )}

      </ScrollView>

      {/* Confetti */}
      <ConfettiCannon
        ref={confettiRef}
        count={80}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        fadeOut
      />

      {/* Room picker modal */}
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

      {/* Member picker modal */}
      <Modal
        visible={memberPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMemberPickerOpen(false)}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.pickerBackdrop]}
          onPress={() => setMemberPickerOpen(false)}
        />
        <View style={styles.pickerWrapper} pointerEvents="box-none">
          <View style={[styles.pickerPopup, isTablet && { maxWidth: 420 }]}>
            <Text style={styles.pickerTitle}>Filter by Member</Text>

            <TouchableOpacity
              style={[styles.pickerOption, filterMemberId === null && styles.pickerOptionSelected]}
              onPress={() => { setFilterMemberId(null); setMemberPickerOpen(false) }}
              activeOpacity={0.65}
            >
              <Text style={styles.pickerOptionEmoji}>👥</Text>
              <Text style={[styles.pickerOptionLabel, filterMemberId === null && styles.pickerOptionLabelSelected]}>
                All Members
              </Text>
              {filterMemberId === null && <Text style={styles.pickerCheck}>✓</Text>}
            </TouchableOpacity>

            {members.map((member) => {
              const selected = filterMemberId === member.id
              return (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                  onPress={() => { setFilterMemberId(member.id); setMemberPickerOpen(false) }}
                  activeOpacity={0.65}
                >
                  <Text style={styles.pickerOptionEmoji}>{member.emoji}</Text>
                  <Text style={[styles.pickerOptionLabel, selected && styles.pickerOptionLabelSelected]}>
                    {member.display_name}
                  </Text>
                  {selected && <Text style={styles.pickerCheck}>✓</Text>}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </Modal>

      {/* Add Task Sheet */}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom:     12,
    backgroundColor:   Colors.background,
  },
  headerTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize['3xl'],
    color:      Colors.textPrimary,
  },
  addBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
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

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Leaderboard
  weekSection: { marginBottom: 4 },
  weekLabel: {
    fontFamily:    Font.semiBold,
    fontSize:      FontSize.xs,
    color:         Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  10,
    marginTop:     8,
  },
  leaderRow: {
    flexDirection: 'row',
    gap:           10,
    paddingBottom: 4,
  },
  leaderCard: {
    alignItems:      'center',
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    paddingVertical:   12,
    paddingHorizontal: 14,
    gap:             4,
    minWidth:        80,
    shadowColor:     Colors.textPrimary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },
  leaderRank: {
    fontSize:   16,
    lineHeight: 20,
  },
  leaderName: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.xs,
    color:      Colors.textPrimary,
    maxWidth:   72,
    textAlign:  'center',
    marginTop:  2,
  },
  leaderCount: {
    fontFamily: Font.regular,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
    textAlign:  'center',
  },

  // Filter pills
  filterRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    marginBottom:   8,
    marginTop:      12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      Radius.full,
    backgroundColor:   Colors.borderSubtle,
    borderWidth:       1.5,
    borderColor:       Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  pillText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.textOnPrimary,
  },

  // Section
  section: { marginBottom: 8 },
  sectionLabel: {
    fontFamily:    Font.semiBold,
    fontSize:      FontSize.xs,
    color:         Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  10,
    marginTop:     16,
  },
  sectionLabelDanger:  { color: Colors.danger },
  sectionLabelWarning: { color: Colors.warning },
  sectionLabelSuccess: { color: Colors.success },

  // Empty state
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     80,
    paddingBottom:  40,
    gap:            8,
  },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
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

  // Picker modal
  pickerBackdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
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
  pickerOptionSelected:      { backgroundColor: Colors.primaryLight },
  pickerOptionEmoji:         { fontSize: 20 },
  pickerOptionLabel: {
    flex:       1,
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
  },
  pickerOptionLabelSelected: { color: Colors.primary },
  pickerCheck: {
    fontFamily: Font.bold,
    fontSize:   FontSize.base,
    color:      Colors.primary,
  },

})
