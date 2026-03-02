import { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

// ── Static data ───────────────────────────────────────────────────────────────

const REWARD_EMOJIS = [
  '🎁', '🏆', '⭐', '🌟', '💎', '🎮', '🍕', '🍦',
  '🎬', '🛍️', '💰', '🎯', '🏖️', '✈️', '📱', '🎨',
  '📚', '🎸', '🍫', '🎪',
]

const POINT_PRESETS = [25, 50, 100, 150, 200, 250, 500]

// ── Component ─────────────────────────────────────────────────────────────────

export default function RewardsScreen() {
  const insets = useSafeAreaInsets()

  const memberId    = useAuthStore((s) => s.memberId)
  const householdId = useAuthStore((s) => s.householdId)
  const rewards     = useHouseholdStore((s) => s.rewards)
  const members     = useHouseholdStore((s) => s.members)
  const isLoading   = useHouseholdStore((s) => s.isLoading)
  const load        = useHouseholdStore((s) => s.load)
  const addReward   = useHouseholdStore((s) => s.addReward)

  // Current member's all-time points
  const myPoints = members.find((m) => m.id === memberId)?.points_total ?? 0

  const [sheetVisible, setSheetVisible] = useState(false)
  const [emoji, setEmoji]               = useState('🎁')
  const [title, setTitle]               = useState('')
  const [pointsIdx, setPointsIdx]       = useState(1) // default 50
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)

  function resetSheet() {
    setEmoji('🎁')
    setTitle('')
    setPointsIdx(1)
    setError(null)
  }

  function closeSheet() {
    resetSheet()
    setSheetVisible(false)
  }

  async function handleSave() {
    if (!title.trim() || !householdId) return
    setLoading(true)
    setError(null)
    try {
      const { reward } = await householdsApi.createReward(householdId, {
        title:          title.trim(),
        emoji,
        pointsRequired: POINT_PRESETS[pointsIdx],
      })
      addReward(reward)
      closeSheet()
    } catch (e: unknown) {
      const msg =
        e instanceof Error                      ? e.message
        : typeof e === 'string'                 ? e
        : typeof (e as any)?.error === 'string' ? (e as any).error
        : 'Could not save reward. Try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = useCallback(async () => {
    if (householdId) await load(householdId)
  }, [householdId, load])

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.screenTitle}>Rewards</Text>
        {/* Points balance */}
        <View style={styles.balancePill}>
          <Text style={styles.balanceStar}>⭐</Text>
          <Text style={styles.balanceText}>{myPoints} pts</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {rewards.map((reward) => {
          const canAfford = myPoints >= reward.points_required
          return (
            <View
              key={reward.id}
              style={[styles.rewardCard, canAfford && styles.rewardCardAffordable]}
            >
              <Text style={styles.rewardEmoji}>{reward.emoji}</Text>
              <View style={styles.rewardBody}>
                <Text style={styles.rewardTitle}>{reward.title}</Text>
                <View style={styles.rewardCostRow}>
                  <Text style={styles.rewardCostStar}>⭐</Text>
                  <Text style={[
                    styles.rewardCost,
                    canAfford && styles.rewardCostAffordable,
                  ]}>
                    {reward.points_required} pts
                  </Text>
                </View>
              </View>
              {canAfford && (
                <View style={styles.affordableBadge}>
                  <Text style={styles.affordableText}>Can redeem</Text>
                </View>
              )}
            </View>
          )
        })}

        {rewards.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>No rewards yet</Text>
            <Text style={styles.emptyBody}>
              Add rewards so family members have something to work towards.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 72 }]}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Add Reward Sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.kavContainer}
          >
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>Add Reward</Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.formScroll}
              >
                <Input
                  label="What's the reward?"
                  placeholder="e.g. Movie night"
                  value={title}
                  onChangeText={setTitle}
                  autoCapitalize="sentences"
                  returnKeyType="done"
                  containerStyle={styles.field}
                />

                {/* Emoji picker */}
                <Text style={styles.fieldLabel}>Emoji</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.emojiRow}
                >
                  {REWARD_EMOJIS.map((e) => (
                    <TouchableOpacity
                      key={e}
                      onPress={() => setEmoji(e)}
                      style={[styles.emojiBtn, emoji === e && styles.emojiBtnSelected]}
                    >
                      <Text style={styles.emojiOpt}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Points stepper */}
                <Text style={styles.fieldLabel}>Points required</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={[styles.stepBtn, pointsIdx === 0 && styles.stepBtnDisabled]}
                    onPress={() => setPointsIdx((i) => Math.max(0, i - 1))}
                    disabled={pointsIdx === 0}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.stepValue}>
                    <Text style={styles.stepValueText}>{POINT_PRESETS[pointsIdx]}</Text>
                    <Text style={styles.stepValueUnit}>pts</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.stepBtn, pointsIdx === POINT_PRESETS.length - 1 && styles.stepBtnDisabled]}
                    onPress={() => setPointsIdx((i) => Math.min(POINT_PRESETS.length - 1, i + 1))}
                    disabled={pointsIdx === POINT_PRESETS.length - 1}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Button
                  label="Save Reward"
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
    flexDirection:     'row',
    alignItems:        'flex-end',
    justifyContent:    'space-between',
  },
  screenTitle: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize['3xl'],
    color:      Colors.textPrimary,
  },
  balancePill: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   Colors.goldLight,
    borderRadius:      20,
    paddingHorizontal: 12,
    paddingVertical:   6,
    gap:               4,
    marginBottom:      2,
  },
  balanceStar: { fontSize: 14 },
  balanceText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.sm,
    color:      Colors.textOnGold,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Reward card
  rewardCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surface,
    borderRadius:    16,
    marginBottom:    10,
    padding:         16,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
    gap:             14,
  },
  rewardCardAffordable: {
    borderWidth: 1.5,
    borderColor: Colors.success,
  },
  rewardEmoji: { fontSize: 36 },
  rewardBody:  { flex: 1 },
  rewardTitle: {
    fontFamily:  Font.semiBold,
    fontSize:    FontSize.base,
    color:       Colors.textPrimary,
    marginBottom: 4,
  },
  rewardCostRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  rewardCostStar: { fontSize: 13 },
  rewardCost: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  rewardCostAffordable: { color: Colors.success },
  affordableBadge: {
    backgroundColor:   Colors.successLight,
    borderRadius:      10,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  affordableText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.xs,
    color:      Colors.success,
  },

  // Empty
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, gap: 8,
  },
  emptyEmoji: { fontSize: 52, marginBottom: 8 },
  emptyTitle: { fontFamily: Font.displayBold, fontSize: FontSize.xl, color: Colors.textPrimary },
  emptyBody:  { fontFamily: Font.regular, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', maxWidth: 260 },

  // FAB
  fab: {
    position:        'absolute',
    right:           20,
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     Colors.primary,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    10,
    elevation:       8,
  },
  fabIcon: {
    fontSize:   28,
    lineHeight: 32,
    color:      '#fff',
    fontFamily: Font.regular,
  },

  // Sheet
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  kavContainer: { width: '100%' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal:    20,
    paddingTop:           12,
    maxHeight:            '80%',
    shadowColor:          '#000',
    shadowOffset:         { width: 0, height: -4 },
    shadowOpacity:        0.08,
    shadowRadius:         16,
    elevation:            10,
  },
  handle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: {
    fontFamily:   Font.displayBold,
    fontSize:     FontSize.xl,
    color:        Colors.textPrimary,
    marginBottom: 16,
  },
  formScroll: { paddingBottom: 8 },
  field:      { marginBottom: 20 },
  fieldLabel: {
    fontFamily:   Font.medium,
    fontSize:     FontSize.sm,
    color:        Colors.textSecondary,
    marginBottom: 10,
  },

  // Emoji picker
  emojiRow: { flexDirection: 'row', gap: 8, paddingBottom: 4, marginBottom: 20 },
  emojiBtn: {
    width:  44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.borderSubtle,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  emojiBtnSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  emojiOpt: { fontSize: 24 },

  // Stepper
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    gap: 16, marginBottom: 20,
  },
  stepBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: {
    fontFamily: Font.bold, fontSize: 20,
    color: Colors.primary, lineHeight: 24,
  },
  stepValue: {
    flex: 1, flexDirection: 'row',
    alignItems: 'baseline', justifyContent: 'center', gap: 4,
  },
  stepValueText: {
    fontFamily: Font.displayBold, fontSize: FontSize['2xl'], color: Colors.textPrimary,
  },
  stepValueUnit: {
    fontFamily: Font.regular, fontSize: FontSize.base, color: Colors.textSecondary,
  },

  saveBtn: { marginTop: 4 },
})
