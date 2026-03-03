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
import { Colors, getCategoryColor } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import type { Recurrence } from '@/types'

// ── Static data ───────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

interface AddTaskSheetProps {
  visible:  boolean
  onClose:  () => void
}

export function AddTaskSheet({ visible, onClose }: AddTaskSheetProps) {
  const insets      = useSafeAreaInsets()
  const { isLandscape, sheetMaxWidth } = useLayout()
  const householdId = useAuthStore((s) => s.householdId)
  const members     = useHouseholdStore((s) => s.members)
  const rooms       = useHouseholdStore((s) => s.rooms)
  const categories  = useHouseholdStore((s) => s.categories)
  const addTask     = useHouseholdStore((s) => s.addTask)

  const [title,          setTitle]          = useState('')
  const [category,       setCategory]       = useState<string>('')
  const [categoryOpen,   setCategoryOpen]   = useState(false)
  const [roomId,         setRoomId]         = useState<string | null>(null)
  const [roomOpen,       setRoomOpen]       = useState(false)
  const [recurrence,     setRecurrence]     = useState<Recurrence>('weekly')
  const [assignedTo,     setAssignedTo]     = useState<string | null>(null)
  const [showAdvanced,   setShowAdvanced]   = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  // Use first category as default when state is empty (e.g. first render before categories load)
  const effectiveCategory = category || categories[0]?.name || 'home'
  const selectedCat       = categories.find((c) => c.name === effectiveCategory) ?? categories[0]
  const catColor          = getCategoryColor(selectedCat?.sort_order ?? 0)

  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null

  function reset() {
    setTitle('')
    setCategory('')
    setCategoryOpen(false)
    setRoomId(null)
    setRoomOpen(false)
    setRecurrence('weekly')
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
        category:   effectiveCategory,
        recurrence,
        assignedTo: assignedTo ?? undefined,
        roomId:     roomId ?? undefined,
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
      <View style={[styles.overlay, sheetMaxWidth && styles.overlayTablet]}>
        {/* Tap backdrop to dismiss */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.kavContainer, sheetMaxWidth && { maxWidth: sheetMaxWidth }]}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, ...(isLandscape ? { maxHeight: '95%' } : {}) }]}>
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
                  {selectedCat?.name ?? effectiveCategory}
                </Text>
                <Text style={[styles.dropdownChevron, { color: catColor.text }]}>▾</Text>
              </TouchableOpacity>

              {/* Category picker — nested modal */}
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
                      const isSelected = effectiveCategory === cat.name
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
                          <Text
                            style={[
                              styles.dropdownOptionLabel,
                              { color: isSelected ? colors.text : Colors.textPrimary },
                            ]}
                          >
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

              {/* Room picker modal */}
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

                    {/* No room option */}
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
                  </View>
                </View>
              </Modal>

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
    maxHeight:            '88%',
    // Top shadow
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

  // Category dropdown trigger
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
  dropdownTriggerEmoji: {
    fontSize: 20,
  },
  dropdownTriggerLabel: {
    flex:       1,
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
  },
  dropdownChevron: {
    fontFamily: Font.regular,
    fontSize:   16,
  },
  dropdownTriggerNeutral: {
    backgroundColor: Colors.borderSubtle,
    borderColor:     Colors.border,
  },

  // Category picker modal
  dropdownBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dropdownPopupWrapper: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 32,
  },
  dropdownPopup: {
    width:           '100%',
    backgroundColor: Colors.surface,
    borderRadius:    20,
    paddingVertical: 8,
    shadowColor:     '#000',
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
  dropdownOptionEmoji: {
    fontSize: 20,
  },
  dropdownOptionLabel: {
    flex:       1,
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
  },
  dropdownOptionCheck: {
    fontFamily: Font.bold,
    fontSize:   FontSize.base,
  },
  // Room-specific overrides
  dropdownOptionNone: {
    backgroundColor: Colors.borderSubtle,
  },
  dropdownOptionRoomSelected: {
    backgroundColor: Colors.primaryLight,
  },
  dropdownOptionRoomLabel: {
    color: Colors.primary,
  },
  dropdownOptionRoomCheck: {
    color: Colors.primary,
  },
  dropdownEmpty: {
    fontFamily:   Font.regular,
    fontSize:     FontSize.sm,
    color:        Colors.textTertiary,
    textAlign:    'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
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
