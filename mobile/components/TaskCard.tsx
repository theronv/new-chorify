import { useRef } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Colors, getCategoryColor } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { getTodayString, useHouseholdStore } from '@/lib/store'
import type { Member, Room, Task } from '@/types'

interface TaskCardProps {
  task:          Task
  members:       Member[]
  rooms:         Room[]
  isCompleted:   boolean
  isCompleting:  boolean
  onComplete?:   () => void
  onDelete?:     () => void
  onLongPress?:  () => void
}

const SWIPE_THRESHOLD = -80   // px — how far left to trigger delete
const SWIPE_CLAMP     = -100  // px — max drag distance

function formatDueShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function daysOverdue(nextDue: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(nextDue + 'T00:00:00')
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000))
}

export function TaskCard({ task, members, rooms, isCompleted, isCompleting, onComplete, onDelete, onLongPress }: TaskCardProps) {
  const today      = getTodayString()
  const categories = useHouseholdStore((s) => s.categories)

  const storeCategory = categories.find((c) => c.name === task.category)
  const catColors     = getCategoryColor(storeCategory?.sort_order ?? 0)

  const assignee   = task.assigned_to ? members.find((m) => m.id === task.assigned_to) : null
  const emoji      = assignee?.emoji ?? '👤'
  const assignName = assignee?.display_name ?? 'Anyone'

  const room = task.room_id ? rooms.find((r) => r.id === task.room_id) : null

  const overdueDays =
    !isCompleted && task.next_due && task.next_due < today
      ? daysOverdue(task.next_due)
      : 0

  // ── Swipe-to-delete ────────────────────────────────────────────────────────

  const panX = useRef(new Animated.Value(0)).current

  const snapBack = () =>
    Animated.spring(panX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start()

  const snapOff = (callback: () => void) =>
    Animated.timing(panX, { toValue: -500, duration: 220, useNativeDriver: true }).start(callback)

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture when it's a clear leftward horizontal swipe
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 &&
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 &&
        gs.dx < 0,

      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) panX.setValue(Math.max(gs.dx, SWIPE_CLAMP))
      },

      onPanResponderRelease: (_, gs) => {
        if (gs.dx < SWIPE_THRESHOLD && onDelete) {
          // Lock card in delete-ready position while the alert is shown
          Animated.spring(panX, { toValue: SWIPE_THRESHOLD, useNativeDriver: true }).start()
          Alert.alert(
            'Delete task?',
            `"${task.title}" will be permanently removed.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: snapBack },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => snapOff(onDelete),
              },
            ],
          )
        } else {
          snapBack()
        }
      },

      onPanResponderTerminate: snapBack,
    }),
  ).current

  // ── Checkbox ───────────────────────────────────────────────────────────────

  const canComplete = !isCompleted && !isCompleting && !!onComplete

  return (
    <Animated.View
      style={[styles.swipeWrapper, { transform: [{ translateX: panX }] }]}
      {...panResponder.panHandlers}
    >
      <Pressable
        style={[styles.card, isCompleted && styles.cardCompleted]}
        onLongPress={onLongPress ? () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onLongPress()
        } : undefined}
        delayLongPress={400}
      >

        {/* Checkbox — only tappable on incomplete tasks */}
        <TouchableOpacity
          style={styles.checkboxWrapper}
          onPress={canComplete ? onComplete : undefined}
          disabled={!canComplete}
          activeOpacity={0.5}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : isCompleted ? (
            <View style={styles.checkboxChecked}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          ) : (
            <View style={[styles.checkboxUnchecked, { borderColor: catColors.text }]} />
          )}
        </TouchableOpacity>

        {/* Left category bar */}
        <View style={[styles.bar, { backgroundColor: catColors.text }]} />

        <View style={styles.content}>
          {/* Row 1: title */}
          <View style={styles.row}>
            <Text
              style={[styles.title, isCompleted && styles.titleCompleted]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            {!!task.is_private && (
              <Ionicons
                name="lock-closed"
                size={12}
                color={Colors.textTertiary}
                style={styles.lockIcon}
              />
            )}
          </View>

          {/* Row 2: category pill + room pill + assignee */}
          <View style={[styles.row, styles.metaRow]}>
            <View style={[styles.categoryPill, { backgroundColor: catColors.bg }]}>
              <Text style={[styles.categoryText, { color: catColors.text }]}>
                {task.category}
              </Text>
            </View>

            {room && (
              <View style={styles.roomPill}>
                <Text style={styles.roomPillText}>{room.emoji} {room.name}</Text>
              </View>
            )}

            {!isCompleted && task.next_due && (
              <View style={[
                styles.duePill,
                task.next_due < today  ? styles.duePillOverdue
                : task.next_due === today ? styles.duePillToday
                : styles.duePillUpcoming,
              ]}>
                <Text style={[
                  styles.duePillText,
                  task.next_due < today  ? styles.duePillTextOverdue
                  : task.next_due === today ? styles.duePillTextToday
                  : styles.duePillTextUpcoming,
                ]}>
                  {formatDueShort(task.next_due)}
                </Text>
              </View>
            )}

            <View style={styles.assigneeRow}>
              <Text style={styles.assigneeEmoji}>{emoji}</Text>
              <Text style={styles.assigneeName}>{assignName}</Text>
            </View>
          </View>

          {/* Row 3: overdue badge */}
          {overdueDays > 0 && (
            <View style={styles.overdueBadge}>
              <Text style={styles.overdueText}>
                ⚠ {overdueDays} {overdueDays === 1 ? 'day' : 'days'} overdue
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  swipeWrapper: {
    marginBottom: 10,
  },

  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surface,
    borderRadius:    16,
    shadowColor:     Colors.textPrimary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
    overflow:        'hidden',
  },
  cardCompleted: {
    backgroundColor: Colors.successLight,
    opacity:         0.8,
  },

  // Checkbox
  checkboxWrapper: {
    width:           48,
    alignSelf:       'stretch',
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkboxUnchecked: {
    width:        22,
    height:       22,
    borderRadius: 11,
    borderWidth:  2,
  },
  checkboxChecked: {
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: Colors.success,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkmark: {
    color:      Colors.textOnPrimary,
    fontFamily: Font.bold,
    fontSize:   12,
    lineHeight: 14,
  },

  // Left colour bar
  bar: {
    width:     4,
    alignSelf: 'stretch',
  },

  content: {
    flex:    1,
    padding: 14,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  metaRow: {
    marginTop: 8,
    gap:       8,
  },

  // Title
  title: {
    flex:        1,
    fontFamily:  Font.semiBold,
    fontSize:    FontSize.base,
    color:       Colors.textPrimary,
    marginRight: 6,
  },
  lockIcon: {
    marginTop: 2,
  },
  titleCompleted: {
    color:              Colors.textSecondary,
    textDecorationLine: 'line-through',
  },

  // Category pill
  categoryPill: {
    borderRadius:      20,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  categoryText: {
    fontFamily:    Font.medium,
    fontSize:      FontSize.xs,
    textTransform: 'capitalize',
  },

  // Room pill
  roomPill: {
    borderRadius:      20,
    paddingHorizontal: 8,
    paddingVertical:   3,
    backgroundColor:   Colors.borderSubtle,
    borderWidth:       1,
    borderColor:       Colors.border,
  },
  roomPillText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
  },

  // Assignee
  assigneeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginLeft:    'auto',
  },
  assigneeEmoji: {
    fontSize: 15,
  },
  assigneeName: {
    fontFamily: Font.regular,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
  },

  // Due date pill
  duePill: {
    borderRadius:      20,
    paddingHorizontal: 7,
    paddingVertical:   3,
  },
  duePillUpcoming: {
    backgroundColor: Colors.borderSubtle,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  duePillToday: {
    backgroundColor: Colors.warningLight,
    borderWidth:     1,
    borderColor:     Colors.warning,
  },
  duePillOverdue: {
    backgroundColor: Colors.dangerLight,
    borderWidth:     1,
    borderColor:     Colors.danger,
  },
  duePillText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.xs,
  },
  duePillTextUpcoming: { color: Colors.textSecondary },
  duePillTextToday:    { color: Colors.warning },
  duePillTextOverdue:  { color: Colors.danger },

  // Overdue badge
  overdueBadge: {
    marginTop:         6,
    alignSelf:         'flex-start',
    backgroundColor:   Colors.dangerLight,
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  overdueText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.xs,
    color:      Colors.danger,
  },
})
