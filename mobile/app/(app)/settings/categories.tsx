// ── Manage categories from Settings ───────────────────────────────────────────
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
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { households as householdsApi, categoriesApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { Colors, getCategoryColor } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import type { HouseholdCategory } from '@/types'

const EMOJI_OPTIONS = ['📦','🏠','🐾','🌿','❤️','👨‍👩‍👧','🚗','🍳','🛏️','🧹','💊','🏋️','🌱','🎨','🔧','🎮','📚','🛁','🧺','✨']

// ── Component ─────────────────────────────────────────────────────────────────

export default function CategoriesScreen() {
  const insets      = useSafeAreaInsets()
  const router      = useRouter()
  const { contentPadding, headerPadding, contentMaxWidth } = useLayout()
  const householdId    = useAuthStore((s) => s.householdId)
  const categories     = useHouseholdStore((s) => s.categories)
  const addCategory    = useHouseholdStore((s) => s.addCategory)
  const updateCategory = useHouseholdStore((s) => s.updateCategory)
  const removeCategory = useHouseholdStore((s) => s.removeCategory)
  const renameCategoryOnTasks = useHouseholdStore((s) => s.renameCategoryOnTasks)

  // ── Modal state (shared for add + rename) ──────────────────────────────────
  const [modalVisible,   setModalVisible]   = useState(false)
  const [modalMode,      setModalMode]      = useState<'add' | 'rename'>('add')
  const [editingCat,     setEditingCat]     = useState<HouseholdCategory | null>(null)
  const [inputName,      setInputName]      = useState('')
  const [inputEmoji,     setInputEmoji]     = useState('📦')
  const [saving,         setSaving]         = useState(false)

  function openAdd() {
    setModalMode('add')
    setEditingCat(null)
    setInputName('')
    setInputEmoji('📦')
    setModalVisible(true)
  }

  function openRename(cat: HouseholdCategory) {
    setModalMode('rename')
    setEditingCat(cat)
    setInputName(cat.name)
    setInputEmoji(cat.emoji)
    setModalVisible(true)
  }

  function closeModal() {
    setModalVisible(false)
    setEditingCat(null)
    setInputName('')
    setInputEmoji('📦')
  }

  async function handleSave() {
    const name = inputName.trim()
    if (!name || !householdId) return
    setSaving(true)
    try {
      if (modalMode === 'add') {
        const { category } = await householdsApi.createCategory(householdId, { name, emoji: inputEmoji })
        addCategory(category)
      } else if (editingCat) {
        const oldName = editingCat.name
        const { category } = await categoriesApi.update(editingCat.id, { name, emoji: inputEmoji })
        updateCategory(editingCat.id, { name: category.name as string, emoji: category.emoji as string })
        // Reflect rename on in-memory tasks
        if (name !== oldName) {
          renameCategoryOnTasks(oldName, name)
        }
      }
      closeModal()
    } catch {
      Alert.alert('Error', 'Could not save category. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(cat: HouseholdCategory) {
    if (categories.length <= 1) {
      Alert.alert('Cannot delete', 'You must have at least one category.')
      return
    }
    Alert.alert(
      'Delete category?',
      `"${cat.name}" will be removed. Tasks using it will be moved to the first remaining category.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => doDelete(cat) },
      ],
    )
  }

  async function doDelete(cat: HouseholdCategory) {
    // Find the fallback category (first remaining, same order the backend uses)
    const fallback = categories.find((c) => c.id !== cat.id)
    try {
      await categoriesApi.delete(cat.id)
      removeCategory(cat.id)
      // Mirror the server-side task reassignment in the local store
      if (fallback) {
        renameCategoryOnTasks(cat.name, fallback.name)
      }
    } catch (e: unknown) {
      const msg =
        typeof (e as any)?.error === 'string'
          ? (e as any).error
          : 'Could not delete category. Please try again.'
      Alert.alert('Error', msg)
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
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Categories</Text>
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
        {categories.length > 0 ? (
          <View style={styles.section}>
            {categories.map((cat, idx) => {
              const colors = getCategoryColor(cat.sort_order)
              return (
                <View key={cat.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.categoryRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: colors.bg }]}>
                      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    </View>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    <TouchableOpacity
                      onPress={() => openRename(cat)}
                      style={styles.renameBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.renameBtnText}>Rename</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmDelete(cat)}
                      style={styles.deleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>No categories yet</Text>
            <Text style={styles.emptyBody}>
              Add categories to organise your tasks.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Add Category</Text>
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
              {modalMode === 'add' ? 'Add Category' : 'Rename Category'}
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
              placeholder="e.g. Outdoor"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="sentences"
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
  },
  backText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.primary,
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

  // Category list
  section: {
    backgroundColor: Colors.surface,
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
    marginBottom:    16,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft:      60,
  },
  categoryRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               10,
  },
  categoryBadge: {
    width:         34,
    height:        34,
    borderRadius:  10,
    alignItems:    'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryName: {
    flex:       1,
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
    textTransform: 'capitalize',
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
    borderRadius:    20,
    padding:         20,
    shadowColor:     '#000',
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
    flex:            1,
    paddingVertical: 13,
    borderRadius:    12,
    backgroundColor: Colors.borderSubtle,
    alignItems:      'center',
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
    color:      '#fff',
  },
})
