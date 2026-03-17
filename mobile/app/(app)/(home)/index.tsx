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
import { Search, List as ListIcon } from 'lucide-react-native'
import { useTaskActions } from '@/lib/hooks'
import {
  selectIsCompletedToday,
  getTodayString,
  useAuthStore,
  useHouseholdStore,
} from '@/lib/store'
import { AddTaskSheet } from '@/components/AddTaskSheet'
import { EditTaskSheet } from '@/components/EditTaskSheet'
import { TaskCard } from '@/components/TaskCard'
import { Toast } from '@/components/Toast'
import { Colors, Radius } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import type { Task } from '@/types'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { isTablet, contentPadding, headerPadding, contentMaxWidth } = useLayout()

  const householdId = useHouseholdStore((s) => s.householdId)
  const tasks       = useHouseholdStore((s) => s.tasks)
  const completions = useHouseholdStore((s) => s.completions)
  const members     = useHouseholdStore((s) => s.members)
  const rooms       = useHouseholdStore((s) => s.rooms)
  const categories  = useHouseholdStore((s) => s.categories)
  const isLoading   = useHouseholdStore((s) => s.isLoading)
  const loadError   = useHouseholdStore((s) => s.loadError)
  const load        = useHouseholdStore((s) => s.load)
  const gamificationEnabled = useHouseholdStore((s) => s.gamificationEnabled)

  const [sheetVisible,       setSheetVisible]       = useState(false)
  const [editingTask,        setEditingTask]        = useState<Task | null>(null)
  const [filterRoomId,       setFilterRoomId]       = useState<string | null>(null)
  const [roomPickerOpen,     setRoomPickerOpen]     = useState(false)
  const [filterCategory,     setFilterCategory]     = useState<string | null>(null)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [filterAssignedTo,   setFilterAssignedTo]   = useState<string | null>(null)
  const [memberPickerOpen,   setMemberPickerOpen]   = useState(false)

  const confettiRef = useRef<any>(null)
  const { handleComplete, handleDelete, completing, deleteError, setDeleteError } = useTaskActions(confettiRef)

  const today       = getTodayString()

  // ── Filter + partition tasks into three sections ──────────────────────────

  const activeRoom     = filterRoomId     ? rooms.find((r) => r.id === filterRoomId)           ?? null : null
  const activeCategory = filterCategory   ? categories.find((c) => c.name === filterCategory)  ?? null : null
  const activeMember   = filterAssignedTo && filterAssignedTo !== 'unassigned'
    ? members.find((m) => m.id === filterAssignedTo) ?? null
    : null

  const visibleTasks = tasks.filter((t) => {
    if (filterRoomId && t.room_id !== filterRoomId) return false
    if (filterCategory && t.category !== filterCategory) return false
    if (filterAssignedTo === 'unassigned' && t.assigned_to !== null) return false
    if (filterAssignedTo && filterAssignedTo !== 'unassigned' && t.assigned_to !== filterAssignedTo) return false
    return true
  })

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
            <Image source={require('../../../assets/AppIcon.png')} style={styles.logo} />
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

        {/* Filter row — room + category + member */}
        <View style={styles.filterRow}>
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
          {categories.length > 0 && (
            <TouchableOpacity
              style={[styles.filterBtn, activeCategory && styles.filterBtnActive]}
              onPress={() => setCategoryPickerOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterBtnText, activeCategory && styles.filterBtnTextActive]}>
                {activeCategory ? `${activeCategory.emoji} ${activeCategory.name}` : '🏷 Category'}
              </Text>
              <Text style={[styles.filterChevron, activeCategory && styles.filterBtnTextActive]}>▾</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.filterBtn, filterAssignedTo !== null && styles.filterBtnActive]}
            onPress={() => setMemberPickerOpen(true)}
            activeOpacity={0.75}
          >
            <Text style={[styles.filterBtnText, filterAssignedTo !== null && styles.filterBtnTextActive]}>
              {filterAssignedTo === 'unassigned'
                ? '⭕ Unassigned'
                : activeMember
                ? `${activeMember.emoji} ${activeMember.display_name}`
                : '👤 Member'}
            </Text>
            <Text style={[styles.filterChevron, filterAssignedTo !== null && styles.filterBtnTextActive]}>▾</Text>
          </TouchableOpacity>
        </View>
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

            <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category filter picker modal */}
      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.pickerBackdrop]}
          onPress={() => setCategoryPickerOpen(false)}
        />
        <View style={styles.pickerWrapper} pointerEvents="box-none">
          <View style={[styles.pickerPopup, isTablet && { maxWidth: 420 }]}>
            <Text style={styles.pickerTitle}>Filter by Category</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
              <TouchableOpacity
                style={[styles.pickerOption, filterCategory === null && styles.pickerOptionSelected]}
                onPress={() => { setFilterCategory(null); setCategoryPickerOpen(false) }}
                activeOpacity={0.65}
              >
                <Text style={styles.pickerOptionEmoji}>📦</Text>
                <Text style={[styles.pickerOptionLabel, filterCategory === null && styles.pickerOptionLabelSelected]}>
                  All Categories
                </Text>
                {filterCategory === null && <Text style={styles.pickerCheck}>✓</Text>}
              </TouchableOpacity>
              {categories.map((cat) => {
                const selected = filterCategory === cat.name
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                    onPress={() => { setFilterCategory(cat.name); setCategoryPickerOpen(false) }}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.pickerOptionEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.pickerOptionLabel, selected && styles.pickerOptionLabelSelected]}>
                      {cat.name}
                    </Text>
                    {selected && <Text style={styles.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Member filter picker modal */}
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
            <ScrollView showsVerticalScrollIndicator={false} style={styles.pickerScroll}>
              <TouchableOpacity
                style={[styles.pickerOption, filterAssignedTo === null && styles.pickerOptionSelected]}
                onPress={() => { setFilterAssignedTo(null); setMemberPickerOpen(false) }}
                activeOpacity={0.65}
              >
                <Text style={styles.pickerOptionEmoji}>👥</Text>
                <Text style={[styles.pickerOptionLabel, filterAssignedTo === null && styles.pickerOptionLabelSelected]}>
                  All Members
                </Text>
                {filterAssignedTo === null && <Text style={styles.pickerCheck}>✓</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerOption, filterAssignedTo === 'unassigned' && styles.pickerOptionSelected]}
                onPress={() => { setFilterAssignedTo('unassigned'); setMemberPickerOpen(false) }}
                activeOpacity={0.65}
              >
                <Text style={styles.pickerOptionEmoji}>⭕</Text>
                <Text style={[styles.pickerOptionLabel, filterAssignedTo === 'unassigned' && styles.pickerOptionLabelSelected]}>
                  Unassigned
                </Text>
                {filterAssignedTo === 'unassigned' && <Text style={styles.pickerCheck}>✓</Text>}
              </TouchableOpacity>
              {members.map((member) => {
                const selected = filterAssignedTo === member.id
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                    onPress={() => { setFilterAssignedTo(member.id); setMemberPickerOpen(false) }}
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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Load error state */}
      {loadError !== null && (
        <View style={styles.errorState}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn't load your tasks</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => householdId && load(householdId)}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Initial loading state */}
      {isLoading && tasks.length === 0 && (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {/* Task list */}
      {loadError === null && !isLoading && <ScrollView
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
            <Search
              size={64}
              color={Colors.textTertiary}
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.emptyTitle}>
              {filterRoomId || filterCategory || filterAssignedTo ? 'No matching tasks' : 'No tasks yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {filterRoomId || filterCategory || filterAssignedTo
                ? 'Nothing due today matches this filter.'
                : 'Your household is all set up! Start adding chores to your list.'}
            </Text>
            {!filterRoomId && !filterCategory && !filterAssignedTo && (
              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={() => setSheetVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.ctaBtnText}>Create first task</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!hasPending && completed.length > 0 && (
          <View style={styles.emptyState}>
            {gamificationEnabled && <Text style={styles.emptyEmoji}>🎉</Text>}
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
      </ScrollView>}

      {/* Confetti — renders off-screen until .start() is called */}
      {gamificationEnabled && (
        <ConfettiCannon
          ref={confettiRef}
          count={80}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          fadeOut
        />
      )}

      <AddTaskSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />

      <EditTaskSheet
        task={editingTask}
        visible={editingTask !== null}
        onClose={() => setEditingTask(null)}
      />

      <Toast
        message={deleteError ?? ''}
        type="error"
        visible={deleteError !== null}
        onHide={() => setDeleteError(null)}
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

  // Filter row
  filterRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    marginTop:     10,
  },

  // Room/date filter button
  filterBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    gap:               6,
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

  pickerScroll: {
    maxHeight: 320,
  },

  // Room picker modal
  pickerBackdrop: {
    backgroundColor: Colors.overlayMedium,
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
  ctaBtn: {
    marginTop:         16,
    paddingHorizontal: 28,
    paddingVertical:   12,
    borderRadius:      Radius.full,
    backgroundColor:   Colors.primary,
  },
  ctaBtnText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.textOnPrimary,
  },

  // Load error
  errorState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        32,
    gap:            8,
  },
  errorEmoji: {
    fontSize:     48,
    marginBottom: 4,
  },
  errorTitle: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize.xl,
    color:      Colors.textPrimary,
    textAlign:  'center',
  },
  errorBody: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    textAlign:  'center',
    maxWidth:   280,
  },
  loadingState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingBottom:  100,
  },
  retryBtn: {
    marginTop:         16,
    paddingHorizontal: 28,
    paddingVertical:   12,
    borderRadius:      Radius.full,
    backgroundColor:   Colors.primary,
  },
  retryBtnText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.textOnPrimary,
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
