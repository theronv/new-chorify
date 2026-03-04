import { useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { households as householdsApi, rooms as roomsApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { Colors, Radius } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import type { Room } from '@/types'

const EMOJI_OPTIONS = ['🏠','🛋️','🍳','🛏️','🚿','🚗','🌿','📚','🎮','🧺','🍽️','🛁','🏋️','🪴','🎨','🏡']

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoomsScreen() {
  const insets      = useSafeAreaInsets()
  const router      = useRouter()
  const { contentPadding, headerPadding, contentMaxWidth } = useLayout()
  const householdId = useAuthStore((s) => s.householdId)
  const rooms       = useHouseholdStore((s) => s.rooms)
  const addRoom     = useHouseholdStore((s) => s.addRoom)
  const updateRoom  = useHouseholdStore((s) => s.updateRoom)
  const removeRoom  = useHouseholdStore((s) => s.removeRoom)

  // ── Modal state (shared for add + rename) ──────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMode,    setModalMode]    = useState<'add' | 'rename'>('add')
  const [editingRoom,  setEditingRoom]  = useState<Room | null>(null)
  const [inputName,    setInputName]    = useState('')
  const [inputEmoji,   setInputEmoji]   = useState('🏠')
  const [saving,       setSaving]       = useState(false)

  function openAdd() {
    setModalMode('add')
    setEditingRoom(null)
    setInputName('')
    setInputEmoji('🏠')
    setModalVisible(true)
  }

  function openRename(room: Room) {
    setModalMode('rename')
    setEditingRoom(room)
    setInputName(room.name)
    setInputEmoji(room.emoji)
    setModalVisible(true)
  }

  function closeModal() {
    setModalVisible(false)
    setEditingRoom(null)
    setInputName('')
    setInputEmoji('🏠')
  }

  async function handleSave() {
    const name = inputName.trim()
    if (!name || !householdId) return
    setSaving(true)
    try {
      if (modalMode === 'add') {
        const { room } = await householdsApi.createRoom(householdId, { name, emoji: inputEmoji })
        addRoom(room)
      } else if (editingRoom) {
        const { room } = await roomsApi.update(editingRoom.id, { name, emoji: inputEmoji })
        updateRoom(editingRoom.id, room)
      }
      closeModal()
    } catch {
      Alert.alert('Error', 'Could not save room. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(room: Room) {
    Alert.alert(
      'Delete room?',
      `"${room.name}" will be removed. Tasks assigned to it won't be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => doDelete(room) },
      ],
    )
  }

  async function doDelete(room: Room) {
    try {
      await roomsApi.delete(room.id)
      removeRoom(room.id)
    } catch {
      Alert.alert('Error', 'Could not delete room. Please try again.')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={[styles.header, { paddingLeft: headerPadding + insets.left, paddingRight: headerPadding + insets.right }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Rooms</Text>
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
        {rooms.length > 0 ? (
          <View style={styles.section}>
            {rooms.map((room, idx) => (
              <View key={room.id}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.roomRow}>
                  <Text style={styles.roomEmoji}>{room.emoji}</Text>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <TouchableOpacity
                    onPress={() => openRename(room)}
                    style={styles.renameBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.renameBtnText}>Rename</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDelete(room)}
                    style={styles.deleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏠</Text>
            <Text style={styles.emptyTitle}>No rooms yet</Text>
            <Text style={styles.emptyBody}>
              Add rooms to organize your tasks by location.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add Room</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add / Rename modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={closeModal} />
        <View style={styles.modalWrapper} pointerEvents="box-none">
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalMode === 'add' ? 'Add Room' : 'Rename Room'}
            </Text>

            {/* Emoji picker */}
            <Text style={styles.modalLabel}>Icon</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiRow}
              style={styles.emojiScroll}
            >
              {EMOJI_OPTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setInputEmoji(e)}
                  style={[styles.emojiOption, inputEmoji === e && styles.emojiOptionSelected]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiOptionText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Name input */}
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={inputName}
              onChangeText={setInputName}
              placeholder="e.g. Living Room"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            {/* Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!inputName.trim() || saving) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!inputName.trim() || saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  backBtn: {
    marginBottom: 4,
    marginLeft:   -4,
  },
  screenTitle: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize['3xl'],
    color:      Colors.textPrimary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop:        8,
  },

  // Room list
  section: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    overflow:        'hidden',
    shadowColor:     Colors.textPrimary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
    marginBottom:    16,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft:      56,
  },
  roomRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               10,
  },
  roomEmoji: {
    fontSize: 22,
    width:    30,
    textAlign: 'center',
  },
  roomName: {
    flex:       1,
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
  },
  renameBtn: {
    backgroundColor:   Colors.primaryLight,
    borderRadius:      8,
    paddingHorizontal: 10,
    paddingVertical:   5,
  },
  renameBtnText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.primary,
  },
  deleteBtn: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: Colors.dangerLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  deleteBtnText: {
    fontFamily: Font.bold,
    fontSize:   FontSize.sm,
    color:      Colors.danger,
    lineHeight: 16,
  },

  // Add button
  addBtn: {
    backgroundColor:   Colors.primaryLight,
    borderRadius:      14,
    paddingVertical:   14,
    alignItems:        'center',
    borderWidth:       1.5,
    borderColor:       Colors.primary,
    borderStyle:       'dashed',
  },
  addBtnText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.primary,
  },

  // Empty state
  emptyState: {
    alignItems:    'center',
    paddingTop:    60,
    paddingBottom: 32,
    gap:           8,
  },
  emptyEmoji: {
    fontSize:     48,
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
    maxWidth:   260,
  },

  // Modal
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalWrapper: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width:           '100%',
    backgroundColor: Colors.surface,
    borderRadius:    Radius.xl,
    padding:         20,
    shadowColor:     Colors.textPrimary,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.15,
    shadowRadius:    24,
    elevation:       16,
  },
  modalTitle: {
    fontFamily:   Font.displayBold,
    fontSize:     FontSize.xl,
    color:        Colors.textPrimary,
    marginBottom: 16,
  },
  modalLabel: {
    fontFamily:   Font.medium,
    fontSize:     FontSize.sm,
    color:        Colors.textSecondary,
    marginBottom: 8,
  },

  // Emoji row
  emojiScroll: {
    marginBottom: 16,
  },
  emojiRow: {
    flexDirection: 'row',
    gap:           8,
    paddingRight:  4,
  },
  emojiOption: {
    width:           42,
    height:          42,
    borderRadius:    12,
    backgroundColor: Colors.borderSubtle,
    borderWidth:     1.5,
    borderColor:     Colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  emojiOptionSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor:     Colors.primary,
  },
  emojiOptionText: {
    fontSize: 22,
  },

  // Name input
  modalInput: {
    borderWidth:       1.5,
    borderColor:       Colors.border,
    borderRadius:      12,
    paddingHorizontal: 14,
    paddingVertical:   12,
    fontFamily:        Font.regular,
    fontSize:          FontSize.base,
    color:             Colors.textPrimary,
    backgroundColor:   Colors.background,
    marginBottom:      20,
  },

  // Modal action buttons
  modalActions: {
    flexDirection: 'row',
    gap:           10,
  },
  cancelBtn: {
    flex:              1,
    paddingVertical:   13,
    borderRadius:      12,
    backgroundColor:   Colors.borderSubtle,
    alignItems:        'center',
  },
  cancelBtnText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.textSecondary,
  },
  saveBtn: {
    flex:            1,
    paddingVertical: 13,
    borderRadius:    12,
    backgroundColor: Colors.primary,
    alignItems:      'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.textOnPrimary,
  },
})
