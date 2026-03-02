import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import type { Member, Task } from '@/types'

interface TaskCardProps {
  task:         Task
  members:      Member[]
  isCompleted:  boolean
  isCompleting: boolean
  onComplete?:  () => void
}

function daysOverdue(nextDue: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(nextDue + 'T00:00:00')
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000))
}

export function TaskCard({ task, members, isCompleted, isCompleting, onComplete }: TaskCardProps) {
  const catColors =
    Colors.category[task.category as keyof typeof Colors.category] ?? Colors.category.home

  const assignee   = task.assigned_to ? members.find((m) => m.id === task.assigned_to) : null
  const emoji      = assignee?.emoji ?? '👤'
  const assignName = assignee?.display_name ?? 'Anyone'

  const overdueDays =
    !isCompleted && task.next_due && task.next_due < new Date().toISOString().slice(0, 10)
      ? daysOverdue(task.next_due)
      : 0

  const canComplete = !isCompleted && !isCompleting && !!onComplete

  return (
    <TouchableOpacity
      activeOpacity={canComplete ? 0.7 : 1}
      onPress={canComplete ? onComplete : undefined}
      style={[styles.card, isCompleted && styles.cardCompleted]}
    >
      {/* Left category bar */}
      <View style={[styles.bar, { backgroundColor: catColors.text }]} />

      <View style={styles.content}>
        {/* Row 1: title + points / checkmark */}
        <View style={styles.row}>
          <Text
            style={[styles.title, isCompleted && styles.titleCompleted]}
            numberOfLines={2}
          >
            {task.title}
          </Text>

          {isCompleting ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.spinner} />
          ) : isCompleted ? (
            <View style={styles.checkBadge}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          ) : (
            <View style={[styles.pointsBadge, { backgroundColor: Colors.goldLight }]}>
              <Text style={[styles.pointsText, { color: Colors.textOnGold }]}>
                {task.points} pts
              </Text>
            </View>
          )}
        </View>

        {/* Row 2: category pill + assignee */}
        <View style={[styles.row, styles.metaRow]}>
          <View style={[styles.categoryPill, { backgroundColor: catColors.bg }]}>
            <Text style={[styles.categoryText, { color: catColors.text }]}>
              {task.category}
            </Text>
          </View>

          <View style={styles.assigneeRow}>
            <Text style={styles.assigneeEmoji}>{emoji}</Text>
            <Text style={styles.assigneeName}>{assignName}</Text>
          </View>
        </View>

        {/* Row 3: overdue badge (only if overdue) */}
        {overdueDays > 0 && (
          <View style={styles.overdueBadge}>
            <Text style={styles.overdueText}>
              ⚠ {overdueDays} {overdueDays === 1 ? 'day' : 'days'} overdue
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    backgroundColor: Colors.surface,
    borderRadius:    16,
    marginBottom:    10,
    shadowColor:     '#000',
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

  // Left colour indicator bar
  bar: {
    width:        4,
    alignSelf:    'stretch',
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
    flex:       1,
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
    marginRight: 10,
  },
  titleCompleted: {
    color: Colors.textSecondary,
  },

  // Points
  pointsBadge: {
    borderRadius:    20,
    paddingHorizontal: 10,
    paddingVertical:   4,
  },
  pointsText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.xs,
  },

  // Check
  checkBadge: {
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: Colors.success,
    alignItems:      'center',
    justifyContent:  'center',
  },
  checkText: {
    color:      '#fff',
    fontFamily: Font.bold,
    fontSize:   FontSize.sm,
  },

  spinner: {
    marginLeft: 8,
  },

  // Category pill
  categoryPill: {
    borderRadius:      20,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  categoryText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.xs,
    textTransform: 'capitalize',
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
