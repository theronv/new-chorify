import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { households as householdsApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Toast } from '@/components/Toast'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import type { Category, Recurrence } from '@/types'

// ── Static data ───────────────────────────────────────────────────────────────

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'home',    label: 'Home',    emoji: '🏠' },
  { value: 'pet',     label: 'Pet',     emoji: '🐾' },
  { value: 'outdoor', label: 'Outdoor', emoji: '🌿' },
  { value: 'health',  label: 'Health',  emoji: '❤️' },
  { value: 'family',  label: 'Family',  emoji: '👨‍👩‍👧' },
  { value: 'vehicle', label: 'Vehicle', emoji: '🚗' },
]

const BASIC_RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: 'daily',    label: 'Daily' },
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly',  label: 'Monthly' },
]
const ADVANCED_RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual',  label: 'Biannual' },
  { value: 'annual',    label: 'Annual' },
  { value: 'once',      label: 'One-time' },
]

const POINT_VALUES = [5, 10, 15, 20, 25]

// ── Component ─────────────────────────────────────────────────────────────────

interface AddTaskSheetProps {
  visible:  boolean
  onClose:  () => void
}

export function AddTaskSheet({ visible, onClose }: AddTaskSheetProps) {
  const insets      = useSafeAreaInsets()
  const householdId = useAuthStore((s) => s.householdId)
  const members     = useHouseholdStore((s) => s.members)
  const addTask     = useHouseholdStore((s) => s.addTask)

  const [title,        setTitle]        = useState('')
  const [category,     setCategory]     = useState<Category>('home')
  const [recurrence,   setRecurrence]   = useState<Recurrence>('weekly')
  const [pointsIdx,    setPointsIdx]    = useState(1) // default 10pts
  const [assignedTo,   setAssignedTo]   = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  function reset() {
    setTitle('')
    setCategory('home')
    setRecurrence('weekly')
    setPointsIdx(1)
    setAssignedTo(null)
    setShowAdvanced(false)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSave() {
    if (!title.trim() || !householdId) return
    setLoading(true)
    setError(null)
    try {
      const { task } = await householdsApi.createTask(householdId, {
        title:      title.trim(),
        category,
        recurrence,
        points:     POINT_VALUES[pointsIdx],
        assignedTo: assignedTo ?? undefined,
      })
      addTask(task)
      handleClose()
    } catch (e: unknown) {
      const msg =
        e instanceof Error                       ? e.message
        : typeof e === 'string'                  ? e
        : typeof (e as any)?.error === 'string'  ? (e as any).error
        : 'Could not save task. Try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Tap backdrop to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kavContainer}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Sheet title */}
            <Text style={styles.sheetTitle}>Add Task</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formScroll}
            >
              {/* Title */}
              <Input
                label="What needs doing?"
                placeholder="e.g. Vacuum the living room"
                value={title}
                onChangeText={setTitle}
                autoCapitalize="sentences"
                returnKeyType="done"
                containerStyle={styles.field}
              />

              {/* Category */}
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => {
                  const selected = category === cat.value
                  const colors   = Colors.category[cat.value]
                  return (
                    <TouchableOpacity
                      key={cat.value}
                      onPress={() => setCategory(cat.value)}
                      style={[
                        styles.categoryBtn,
                        { borderColor: selected ? colors.text : Colors.border },
                        selected && { backgroundColor: colors.bg },
                      ]}
                    >
                      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                      <Text
                        style={[
                          styles.categoryBtnLabel,
                          { color: selected ? colors.text : Colors.textSecondary },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Recurrence */}
              <Text style={styles.fieldLabel}>How often?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}
              >
                {BASIC_RECURRENCES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setRecurrence(r.value)}
                    style={[styles.pill, recurrence === r.value && styles.pillSelected]}
                  >
                    <Text
                      style={[
                        styles.pillLabel,
                        recurrence === r.value && styles.pillLabelSelected,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {showAdvanced && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {ADVANCED_RECURRENCES.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      onPress={() => setRecurrence(r.value)}
                      style={[styles.pill, recurrence === r.value && styles.pillSelected]}
                    >
                      <Text
                        style={[
                          styles.pillLabel,
                          recurrence === r.value && styles.pillLabelSelected,
                        ]}
                      >
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity
                onPress={() => setShowAdvanced((v) => !v)}
                style={styles.advancedToggle}
              >
                <Text style={styles.advancedToggleText}>
                  {showAdvanced ? '▲ Less options' : '▼ Advanced'}
                </Text>
              </TouchableOpacity>

              {/* Points stepper */}
              <Text style={styles.fieldLabel}>Points</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[styles.stepBtn, pointsIdx === 0 && styles.stepBtnDisabled]}
                  onPress={() => setPointsIdx((i) => Math.max(0, i - 1))}
                  disabled={pointsIdx === 0}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.stepValue}>
                  <Text style={styles.stepValueText}>{POINT_VALUES[pointsIdx]}</Text>
                  <Text style={styles.stepValueUnit}>pts</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.stepBtn,
                    pointsIdx === POINT_VALUES.length - 1 && styles.stepBtnDisabled,
                  ]}
                  onPress={() =>
                    setPointsIdx((i) => Math.min(POINT_VALUES.length - 1, i + 1))
                  }
                  disabled={pointsIdx === POINT_VALUES.length - 1}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Assignee */}
              <Text style={styles.fieldLabel}>Assign to</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.assigneeRow}
              >
                {/* Anyone */}
                <TouchableOpacity
                  onPress={() => setAssignedTo(null)}
                  style={[
                    styles.assigneeBtn,
                    assignedTo === null && styles.assigneeBtnSelected,
                  ]}
                >
                  <Text style={styles.assigneeBtnEmoji}>👤</Text>
                  <Text style={styles.assigneeBtnName}>Anyone</Text>
                </TouchableOpacity>

                {members.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setAssignedTo(m.id)}
                    style={[
                      styles.assigneeBtn,
                      assignedTo === m.id && styles.assigneeBtnSelected,
                    ]}
                  >
                    <Text style={styles.assigneeBtnEmoji}>{m.emoji}</Text>
                    <Text style={styles.assigneeBtnName} numberOfLines={1}>
                      {m.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            {/* Save */}
            <Button
              label="Save Task"
              onPress={handleSave}
              loading={loading}
              disabled={!title.trim() || loading}
              style={styles.saveBtn}
            />
          </View>
        </KeyboardAvoidingView>
      </View>

      <Toast
        message={error ?? ''}
        type="error"
        visible={error !== null}
        onHide={() => setError(null)}
      />
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kavContainer: {
    width: '100%',
  },
  sheet: {
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal:    20,
    paddingTop:           12,
    maxHeight:            '88%',
    // Top shadow
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -4 },
    shadowOpacity:        0.08,
    shadowRadius:         16,
    elevation:            10,
  },

  handle: {
    width:           44,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.border,
    alignSelf:       'center',
    marginBottom:    16,
  },
  sheetTitle: {
    fontFamily:   Font.displayBold,
    fontSize:     FontSize.xl,
    color:        Colors.textPrimary,
    marginBottom: 16,
  },
  formScroll: {
    paddingBottom: 8,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily:   Font.medium,
    fontSize:     FontSize.sm,
    color:        Colors.textSecondary,
    marginBottom: 10,
  },

  // Category grid
  categoryGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    marginBottom:   20,
  },
  categoryBtn: {
    width:            '31%',
    alignItems:       'center',
    paddingVertical:  10,
    borderRadius:     12,
    borderWidth:      1.5,
    borderColor:      Colors.border,
    backgroundColor:  Colors.borderSubtle,
    gap:              4,
  },
  categoryEmoji: { fontSize: 22 },
  categoryBtnLabel: {
    fontFamily: Font.medium,
    fontSize:   FontSize.xs,
  },

  // Recurrence pills
  pillRow: {
    flexDirection: 'row',
    gap:           8,
    paddingBottom: 4,
    marginBottom:  4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      20,
    backgroundColor:   Colors.borderSubtle,
    borderWidth:       1.5,
    borderColor:       Colors.border,
  },
  pillSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor:     Colors.primary,
  },
  pillLabel: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  pillLabelSelected: {
    color: Colors.primary,
  },
  advancedToggle: {
    alignSelf:    'flex-start',
    marginTop:    4,
    marginBottom: 20,
  },
  advancedToggleText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.primary,
  },

  // Points stepper
  stepper: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            16,
    marginBottom:   20,
  },
  stepBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: Colors.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  stepBtnText: {
    fontFamily: Font.bold,
    fontSize:   20,
    color:      Colors.primary,
    lineHeight: 24,
  },
  stepValue: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'baseline',
    justifyContent: 'center',
    gap:            4,
  },
  stepValueText: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize['2xl'],
    color:      Colors.textPrimary,
  },
  stepValueUnit: {
    fontFamily: Font.regular,
    fontSize:   FontSize.base,
    color:      Colors.textSecondary,
  },

  // Assignee
  assigneeRow: {
    flexDirection: 'row',
    gap:           8,
    paddingBottom: 4,
    marginBottom:  20,
  },
  assigneeBtn: {
    alignItems:      'center',
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:    12,
    backgroundColor: Colors.borderSubtle,
    borderWidth:     1.5,
    borderColor:     Colors.border,
    minWidth:        64,
    gap:             2,
  },
  assigneeBtnSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor:     Colors.primary,
  },
  assigneeBtnEmoji: { fontSize: 22 },
  assigneeBtnName: {
    fontFamily: Font.medium,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
    maxWidth:   64,
    textAlign:  'center',
  },

  saveBtn: {
    marginTop: 8,
  },
})
