import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tasks as tasksApi } from '@/lib/api'
import { useHouseholdStore } from '@/lib/store'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Toast } from '@/components/Toast'
import { Colors, getCategoryColor } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import { parseCustomDays } from '@/types'
import type { Recurrence, Task } from '@/types'

// ── Static data ───────────────────────────────────────────────────────────────

const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: 'daily',     label: 'Daily' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Biweekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual',  label: 'Biannual' },
  { value: 'annual',    label: 'Annual' },
  { value: 'once',      label: 'One-time' },
]

// Offset in days → display label
const DUE_CHIPS: { label: string; days: number | null }[] = [
  { label: 'No date',  days: null },
  { label: 'Today',    days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: '1 week',   days: 7 },
  { label: '2 weeks',  days: 14 },
  { label: '1 month',  days: 30 },
  { label: '3 months', days: 90 },
]

function addDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA')
}

function chipDate(days: number | null): string | null {
  return days === null ? null : addDays(days)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EditTaskSheetProps {
  task:    Task | null
  visible: boolean
  onClose: () => void
}

export function EditTaskSheet({ task, visible, onClose }: EditTaskSheetProps) {
  const insets      = useSafeAreaInsets()
  const { isLandscape, sheetMaxWidth } = useLayout()
  const members     = useHouseholdStore((s) => s.members)
  const rooms       = useHouseholdStore((s) => s.rooms)
  const categories  = useHouseholdStore((s) => s.categories)
  const updateTask  = useHouseholdStore((s) => s.updateTask)

  const [title,        setTitle]        = useState('')
  const [category,     setCategory]     = useState<string>('home')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [roomId,       setRoomId]       = useState<string | null>(null)
  const [roomOpen,     setRoomOpen]     = useState(false)
  const [recurrence,   setRecurrence]   = useState<Recurrence>('weekly')
  const [customDays,   setCustomDays]   = useState(2)
  const [isPrivate,    setIsPrivate]    = useState(false)
  const [assignedTo,   setAssignedTo]   = useState<string | null>(null)
  const [nextDue,          setNextDue]          = useState<string | null>(null)
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState<string | null>(null)

  // Populate fields whenever a new task is opened
  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setCategory(task.category as string)
    setRoomId(task.room_id)
    setRecurrence(task.recurrence)
    const n = parseCustomDays(task.recurrence)
    if (n !== null) setCustomDays(n)
    setIsPrivate(!!task.is_private)
    setNextDue(task.next_due)
    setAssignedTo(task.assigned_to)
    setShowCustomPicker(false)
    setError(null)
  }, [task?.id, visible])

  const selectedCat  = categories.find((c) => c.name === category) ?? categories[0]
  const catColor     = getCategoryColor(selectedCat?.sort_order ?? 0)
  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null

  // Whether the current nextDue matches any preset chip
  const isPresetActive = DUE_CHIPS.some((c) => chipDate(c.days) === nextDue)
  const isCustomActive = showCustomPicker || (nextDue !== null && !isPresetActive)

  const pickerDate = nextDue
    ? new Date(nextDue + 'T00:00:00')
    : new Date()

  async function handleSave() {
    if (!task || !title.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { task: updated } = await tasksApi.update(task.id, {
        title:      title.trim(),
        category,
        recurrence,
        assignedTo: assignedTo ?? null,
        roomId:     roomId ?? null,
        nextDue:    nextDue ?? null,
        isPrivate,
      })
      updateTask(task.id, {
        title:       updated.title,
        category:    updated.category,
        recurrence:  updated.recurrence,
        assigned_to: updated.assigned_to,
        room_id:     updated.room_id,
        next_due:    updated.next_due,
        notes:       updated.notes,
      })
      onClose()
    } catch (e: unknown) {
      const msg =
        e instanceof Error                       ? e.message
        : typeof e === 'string'                  ? e
        : typeof (e as any)?.error === 'string'  ? (e as any).error
        : 'Could not save changes. Try again.'
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
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, sheetMaxWidth ? styles.overlayTablet : {}]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.kavContainer, sheetMaxWidth ? { maxWidth: sheetMaxWidth } : {}]}
        >

          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, ...(isLandscape ? { maxHeight: '95%' } : {}) }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Edit Task</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formScroll}
            >
              {/* Title */}
              <Input
                label="Task name"
                placeholder="e.g. Vacuum the living room"
                value={title}
                onChangeText={setTitle}
                autoCapitalize="sentences"
                returnKeyType="done"
                containerStyle={styles.field}
              />

              {/* Category dropdown */}
              <Text style={styles.fieldLabel}>Category</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownTrigger,
                  { borderColor: catColor.text, backgroundColor: catColor.bg },
                ]}
                onPress={() => setCategoryOpen(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.dropdownTriggerEmoji}>{selectedCat?.emoji ?? '📦'}</Text>
                <Text style={[styles.dropdownTriggerLabel, { color: catColor.text }]}>
                  {selectedCat?.name ?? category}
                </Text>
                <Text style={[styles.dropdownChevron, { color: catColor.text }]}>▾</Text>
              </TouchableOpacity>

              <Modal
                visible={categoryOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setCategoryOpen(false)}
              >
                <Pressable
                  style={[StyleSheet.absoluteFill, styles.dropdownBackdrop]}
                  onPress={() => setCategoryOpen(false)}
                />
                <View style={styles.dropdownPopupWrapper} pointerEvents="box-none">
                  <View style={styles.dropdownPopup}>
                    <Text style={styles.dropdownPopupTitle}>Category</Text>
                    {categories.map((cat) => {
                      const isSelected = category === cat.name
                      const colors     = getCategoryColor(cat.sort_order)
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.dropdownOption,
                            isSelected && { backgroundColor: colors.bg },
                          ]}
                          onPress={() => { setCategory(cat.name); setCategoryOpen(false) }}
                          activeOpacity={0.65}
                        >
                          <Text style={styles.dropdownOptionEmoji}>{cat.emoji}</Text>
                          <Text style={[
                            styles.dropdownOptionLabel,
                            { color: isSelected ? colors.text : Colors.textPrimary },
                          ]}>
                            {cat.name}
                          </Text>
                          {isSelected && (
                            <Text style={[styles.dropdownOptionCheck, { color: colors.text }]}>✓</Text>
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </View>
              </Modal>

              {/* Room dropdown */}
              <Text style={styles.fieldLabel}>Room</Text>
              <TouchableOpacity
                style={[styles.dropdownTrigger, styles.dropdownTriggerNeutral]}
                onPress={() => setRoomOpen(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.dropdownTriggerEmoji}>
                  {selectedRoom ? selectedRoom.emoji : '📍'}
                </Text>
                <Text style={[styles.dropdownTriggerLabel, { color: Colors.textPrimary }]}>
                  {selectedRoom ? selectedRoom.name : 'No room'}
                </Text>
                <Text style={[styles.dropdownChevron, { color: Colors.textSecondary }]}>▾</Text>
              </TouchableOpacity>

              <Modal
                visible={roomOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setRoomOpen(false)}
              >
                <Pressable
                  style={[StyleSheet.absoluteFill, styles.dropdownBackdrop]}
                  onPress={() => setRoomOpen(false)}
                />
                <View style={styles.dropdownPopupWrapper} pointerEvents="box-none">
                  <View style={styles.dropdownPopup}>
                    <Text style={styles.dropdownPopupTitle}>Room</Text>
                    <ScrollView showsVerticalScrollIndicator={false} style={styles.dropdownScroll}>
                      <TouchableOpacity
                        style={[styles.dropdownOption, roomId === null && styles.dropdownOptionNone]}
                        onPress={() => { setRoomId(null); setRoomOpen(false) }}
                        activeOpacity={0.65}
                      >
                        <Text style={styles.dropdownOptionEmoji}>📍</Text>
                        <Text style={[styles.dropdownOptionLabel, roomId === null && { color: Colors.textSecondary }]}>
                          No room
                        </Text>
                        {roomId === null && (
                          <Text style={[styles.dropdownOptionCheck, { color: Colors.textSecondary }]}>✓</Text>
                        )}
                      </TouchableOpacity>
                      {rooms.map((r) => {
                        const isSelected = roomId === r.id
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.dropdownOption, isSelected && styles.dropdownOptionRoomSelected]}
                            onPress={() => { setRoomId(r.id); setRoomOpen(false) }}
                            activeOpacity={0.65}
                          >
                            <Text style={styles.dropdownOptionEmoji}>{r.emoji}</Text>
                            <Text style={[styles.dropdownOptionLabel, isSelected && styles.dropdownOptionRoomLabel]}>
                              {r.name}
                            </Text>
                            {isSelected && (
                              <Text style={[styles.dropdownOptionCheck, styles.dropdownOptionRoomCheck]}>✓</Text>
                            )}
                          </TouchableOpacity>
                        )
                      })}
                      {rooms.length === 0 && (
                        <Text style={styles.dropdownEmpty}>
                          No rooms set up yet.{'\n'}Add rooms in Settings → Rooms.
                        </Text>
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              {/* Recurrence */}
              <Text style={styles.fieldLabel}>How often?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {RECURRENCES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => {
                      setRecurrence(r.value)
                      // When recurrence changes, reset next_due to today so the task
                      // is immediately due under the new schedule (user can still override).
                      if (r.value !== recurrence && r.value !== 'once') {
                        setNextDue(new Date().toLocaleDateString('en-CA'))
                      } else if (r.value === 'once') {
                        setNextDue(nextDue) // keep current
                      }
                    }}
                    style={[styles.chip, recurrence === r.value && styles.chipSelected]}
                  >
                    <Text style={[styles.chipLabel, recurrence === r.value && styles.chipLabelSelected]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                {/* Custom N-day chip */}
                {(() => {
                  const active = parseCustomDays(recurrence) !== null
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        const n = active ? (parseCustomDays(recurrence) ?? customDays) : customDays
                        setCustomDays(n)
                        const newRec = `every_${n}_days`
                        if (newRec !== recurrence) {
                          setNextDue(new Date().toLocaleDateString('en-CA'))
                        }
                        setRecurrence(newRec as Recurrence)
                        }}

                      style={[styles.chip, active && styles.chipSelected]}
                    >
                      <Text style={[styles.chipLabel, active && styles.chipLabelSelected]}>
                        {active ? `Every ${parseCustomDays(recurrence)}d` : 'Custom…'}
                      </Text>
                    </TouchableOpacity>
                  )
                })()}
              </ScrollView>

              {/* Custom day stepper */}
              {parseCustomDays(recurrence) !== null && (
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const n = Math.max(2, customDays - 1)
                      setCustomDays(n)
                      setRecurrence(`every_${n}_days` as Recurrence)
                    }}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>Every {customDays} days</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      const n = Math.min(364, customDays + 1)
                      setCustomDays(n)
                      setRecurrence(`every_${n}_days` as Recurrence)
                    }}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Next due date */}
              <Text style={styles.fieldLabel}>Next due date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {DUE_CHIPS.map((c) => {
                  const val      = chipDate(c.days)
                  const isActive = nextDue === val && !showCustomPicker
                  return (
                    <TouchableOpacity
                      key={c.label}
                      onPress={() => { setNextDue(val); setShowCustomPicker(false) }}
                      style={[styles.chip, isActive && styles.chipSelected]}
                    >
                      <Text style={[styles.chipLabel, isActive && styles.chipLabelSelected]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}

                {/* Custom chip */}
                <TouchableOpacity
                  onPress={() => setShowCustomPicker((v) => !v)}
                  style={[styles.chip, isCustomActive && styles.chipSelected]}
                >
                  <Text style={[styles.chipLabel, isCustomActive && styles.chipLabelSelected]}>
                    {isCustomActive && nextDue && !showCustomPicker
                      ? nextDue          // show the picked date in the chip
                      : 'Custom…'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Inline date picker — shown when Custom is active */}
              {showCustomPicker && (
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(_: DateTimePickerEvent, date?: Date) => {
                    if (date) {
                      setNextDue(date.toLocaleDateString('en-CA'))
                      if (Platform.OS === 'android') setShowCustomPicker(false)
                    }
                  }}
                  minimumDate={new Date()}
                  style={styles.datePicker}
                />
              )}

              {/* Assignee */}
              <Text style={styles.fieldLabel}>Assign to</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.assigneeRow}
              >
                <TouchableOpacity
                  onPress={() => setAssignedTo(null)}
                  style={[styles.assigneeBtn, assignedTo === null && styles.assigneeBtnSelected]}
                >
                  <Text style={styles.assigneeBtnEmoji}>👤</Text>
                  <Text style={styles.assigneeBtnName}>Anyone</Text>
                </TouchableOpacity>
                {members.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setAssignedTo(m.id)}
                    style={[styles.assigneeBtn, assignedTo === m.id && styles.assigneeBtnSelected]}
                  >
                    <Text style={styles.assigneeBtnEmoji}>{m.emoji}</Text>
                    <Text style={styles.assigneeBtnName} numberOfLines={1}>{m.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Private toggle */}
              <View style={styles.privacyRow}>
                <Ionicons name="lock-closed-outline" size={18} color={isPrivate ? Colors.primary : Colors.textTertiary} />
                <View style={styles.privacyText}>
                  <Text style={[styles.privacyLabel, isPrivate && styles.privacyLabelActive]}>Private task</Text>
                  <Text style={styles.privacySub}>Only visible to you</Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: Colors.borderSubtle, true: Colors.primaryLight }}
                  thumbColor={isPrivate ? Colors.primary : Colors.textTertiary}
                  ios_backgroundColor={Colors.borderSubtle}
                />
              </View>

              <Button
                label="Save Changes"
                onPress={handleSave}
                loading={loading}
                disabled={!title.trim() || loading}
                style={styles.saveBtn}
              />
            </ScrollView>
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
  overlayTablet: {
    alignItems: 'center',
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
    maxHeight:            '90%',
    shadowColor:          Colors.textPrimary,
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

  // Dropdown trigger
  dropdownTrigger: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 14,
    paddingVertical:   12,
    borderRadius:      12,
    borderWidth:       1.5,
    marginBottom:      20,
  },
  dropdownTriggerNeutral: {
    backgroundColor: Colors.borderSubtle,
    borderColor:     Colors.border,
  },
  dropdownTriggerEmoji: { fontSize: 20 },
  dropdownTriggerLabel: {
    flex:       1,
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
  },
  dropdownChevron: {
    fontFamily: Font.regular,
    fontSize:   16,
  },

  // Dropdown modal
  dropdownBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dropdownPopupWrapper: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
  },
  dropdownPopup: {
    width:           '100%',
    backgroundColor: Colors.surface,
    borderRadius:    20,
    paddingVertical: 8,
    shadowColor:     Colors.textPrimary,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.15,
    shadowRadius:    24,
    elevation:       16,
  },
  dropdownPopupTitle: {
    fontFamily:        Font.semiBold,
    fontSize:          FontSize.sm,
    color:             Colors.textSecondary,
    textTransform:     'uppercase',
    letterSpacing:     0.8,
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  dropdownOption: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   13,
    borderRadius:      12,
    marginHorizontal:  6,
  },
  dropdownOptionEmoji: { fontSize: 20 },
  dropdownOptionLabel: {
    flex:       1,
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
  },
  dropdownOptionCheck: {
    fontFamily: Font.bold,
    fontSize:   FontSize.base,
  },
  dropdownOptionNone: {
    backgroundColor: Colors.borderSubtle,
  },
  dropdownOptionRoomSelected: {
    backgroundColor: Colors.primaryLight,
  },
  dropdownOptionRoomLabel: { color: Colors.primary },
  dropdownOptionRoomCheck: { color: Colors.primary },
  dropdownScroll: {
    maxHeight: 320,
  },
  dropdownEmpty: {
    fontFamily:        Font.regular,
    fontSize:          FontSize.sm,
    color:             Colors.textTertiary,
    textAlign:         'center',
    paddingVertical:   16,
    paddingHorizontal: 16,
  },

  // Chips (recurrence + due date)
  chipRow: {
    flexDirection: 'row',
    gap:           8,
    paddingBottom: 4,
    marginBottom:  20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      20,
    backgroundColor:   Colors.borderSubtle,
    borderWidth:       1.5,
    borderColor:       Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor:     Colors.primary,
  },
  chipLabel: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  chipLabelSelected: { color: Colors.primary },

  stepperRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    marginTop:      -12,
    marginBottom:   12,
  },
  stepperBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: Colors.primaryLight,
    borderWidth:     1.5,
    borderColor:     Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepperBtnText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.lg,
    color:      Colors.primary,
    lineHeight: 20,
  },
  stepperValue: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.sm,
    color:      Colors.textPrimary,
    flex:       1,
    textAlign:  'center',
  },

  datePicker: {
    marginBottom: 12,
  },

  // Assignee
  assigneeRow: {
    flexDirection: 'row',
    gap:           8,
    paddingBottom: 4,
    marginBottom:  20,
  },
  assigneeBtn: {
    alignItems:        'center',
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      12,
    backgroundColor:   Colors.borderSubtle,
    borderWidth:       1.5,
    borderColor:       Colors.border,
    minWidth:          64,
    gap:               2,
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

  privacyRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    paddingVertical: 14,
    borderTopWidth:  1,
    borderTopColor:  Colors.borderSubtle,
    marginTop:       8,
  },
  privacyText: {
    flex: 1,
  },
  privacyLabel: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  privacyLabelActive: {
    color: Colors.textPrimary,
  },
  privacySub: {
    fontFamily: Font.regular,
    fontSize:   FontSize.xs,
    color:      Colors.textTertiary,
    marginTop:  2,
  },
  saveBtn: { marginTop: 8 },
})
