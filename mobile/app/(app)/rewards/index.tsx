import { useCallback, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gift } from 'lucide-react-native'
import { households as householdsApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { MemberAvatar } from '@/components/MemberAvatar'
import { Toast } from '@/components/Toast'
import { Colors, Radius } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'
import type { Member, Reward } from '@/types'

const REWARD_EMOJIS = ['🎁', '🍕', '🎮', '🍦', '🎬', '🛌', '👟', '🍭', '🧸', '🚲']

export default function RewardsScreen() {
  const insets = useSafeAreaInsets()
  const { isTablet, contentPadding, headerPadding, contentMaxWidth, sheetMaxWidth } = useLayout()

  const memberId    = useAuthStore((s) => s.memberId)
  const householdId = useHouseholdStore((s) => s.householdId)
  const members     = useHouseholdStore((s) => s.members)
  const isLoading   = useHouseholdStore((s) => s.isLoading)
  const load        = useHouseholdStore((s) => s.load)

  const [rewards,      setRewards]      = useState<Reward[]>([])
  const [sheetVisible, setSheetVisible] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Add Reward state
  const [title,          setTitle]          = useState('')
  const [pointsRequired, setPointsRequired] = useState('')
  const [emoji,          setEmoji]          = useState('🎁')
  const [assignedTo,     setAssignedTo]     = useState<string | null>(null)
  const [saving,         setSaving]         = useState(false)

  const me = members.find((m) => m.id === memberId)

  const fetchRewards = useCallback(async () => {
    if (!householdId) return
    try {
      const res = await householdsApi.getRewards(householdId)
      setRewards(res.rewards)
    } catch (e) {
      console.error('[Rewards] Fetch failed:', e)
    }
  }, [householdId])

  // Initial load
  useCallback(() => { fetchRewards() }, [fetchRewards])

  const handleRefresh = async () => {
    if (householdId) {
      await Promise.all([load(householdId, true), fetchRewards()])
    }
  }

  async function handleSaveReward() {
    if (!title.trim() || !pointsRequired || !householdId) return
    setSaving(true)
    try {
      const res = await householdsApi.createReward(householdId, {
        title: title.trim(),
        pointsRequired: parseInt(pointsRequired, 10),
        emoji,
        assignedTo: assignedTo || undefined,
      })
      setRewards((prev) => [...prev, res.reward].sort((a, b) => a.points_required - b.points_required))
      setSheetVisible(false)
      setTitle('')
      setPointsRequired('')
      setEmoji('🎁')
      setAssignedTo(null)
    } catch (e) {
      setError('Could not save reward. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleClaim(reward: Reward) {
    if (!me) return
    if (me.points_total < reward.points_required) {
      Alert.alert('Not enough points', `You need ${reward.points_required} points to claim this reward. You have ${me.points_total}.`)
      return
    }

    Alert.alert(
      'Claim reward?',
      `Are you sure you want to claim "${reward.title}" for ${reward.points_required} points?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim!',
          onPress: () => {
            // In a real app, this would deduct points on the server.
            // For now, we'll just show a success message as it's a v1.5 scaffold.
            Alert.alert('Success!', 'Reward claimed. Ask your parent/partner to redeem it!')
          }
        }
      ]
    )
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingLeft: headerPadding + insets.left, paddingRight: headerPadding + insets.right }]}>
        <View style={styles.headerTop}>
          <View style={styles.titleRow}>
            <Gift size={32} color={Colors.primary} />
            <Text style={styles.screenTitle}>Rewards</Text>
          </View>
          {me?.is_child === 0 && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.addBtnIcon}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

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
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Points Summary */}
        <View style={styles.pointsSummary}>
          <Text style={styles.pointsLabel}>Your Points</Text>
          <Text style={styles.pointsValue}>{me?.points_total ?? 0}</Text>
        </View>

        {/* Member list for visibility */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberPointsRow}>
          {members.map(m => (
            <View key={m.id} style={styles.memberPointCard}>
              <MemberAvatar member={m} size={28} />
              <Text style={styles.memberPointName} numberOfLines={1}>{m.display_name}</Text>
              <Text style={styles.memberPointValue}>{m.points_total}</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Available Rewards</Text>

        {rewards.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Gift size={64} color={Colors.textTertiary} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No rewards yet</Text>
            <Text style={styles.emptyBody}>
              {me?.is_child === 0
                ? "Add rewards like 'Extra Screen Time' or 'Pizza Night' to motivate your family!"
                : "Ask your parents to add some rewards!"}
            </Text>
          </View>
        )}

        {rewards.map((reward) => (
          <TouchableOpacity
            key={reward.id}
            style={styles.rewardCard}
            onPress={() => handleClaim(reward)}
            activeOpacity={0.7}
          >
            <Text style={styles.rewardEmoji}>{reward.emoji}</Text>
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardTitle}>{reward.title}</Text>
              {reward.assigned_to && (
                <Text style={styles.rewardSub}>
                  For {members.find(m => m.id === reward.assigned_to)?.display_name}
                </Text>
              )}
            </View>
            <View style={[styles.pointsBadge, me && me.points_total < reward.points_required && styles.pointsBadgeLocked]}>
              <Text style={styles.pointsBadgeText}>{reward.points_required}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Add Reward Sheet */}
      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <View style={[styles.overlay, sheetMaxWidth ? styles.overlayTablet : {}]}>

          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetVisible(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Add Reward</Text>

            <Input label="Reward Name" placeholder="e.g. 30 mins Screen Time" value={title} onChangeText={setTitle} />
            <Input label="Points Required" placeholder="e.g. 50" value={pointsRequired} onChangeText={setPointsRequired} keyboardType="numeric" containerStyle={{ marginTop: 16 }} />

            <Text style={styles.fieldLabel}>Emoji</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
              {REWARD_EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => setEmoji(e)} style={[styles.emojiBtn, emoji === e && styles.emojiBtnSelected]}>
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Button label="Save Reward" onPress={handleSaveReward} loading={saving} disabled={!title.trim() || !pointsRequired || saving} style={{ marginTop: 24 }} />
          </View>
        </View>
      </Modal>

      <Toast message={error ?? ''} type="error" visible={error !== null} onHide={() => setError(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: Colors.background },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  screenTitle: { fontFamily: Font.displayBold, fontSize: FontSize['3xl'], color: Colors.textPrimary },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnIcon: { fontSize: 26, color: Colors.textOnPrimary, fontFamily: Font.regular },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  pointsSummary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  pointsLabel: { fontFamily: Font.medium, fontSize: FontSize.sm, color: Colors.textOnPrimary, opacity: 0.8 },
  pointsValue: { fontFamily: Font.displayBold, fontSize: 48, color: Colors.textOnPrimary },

  memberPointsRow: { gap: 10, paddingBottom: 16 },
  memberPointCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 10,
    alignItems: 'center',
    minWidth: 80,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  memberPointName: { fontFamily: Font.semiBold, fontSize: 10, color: Colors.textSecondary, marginTop: 4 },
  memberPointValue: { fontFamily: Font.bold, fontSize: 14, color: Colors.textPrimary },

  sectionLabel: { fontFamily: Font.semiBold, fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, marginTop: 10 },

  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 10,
    gap: 14,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  rewardEmoji: { fontSize: 32 },
  rewardInfo: { flex: 1 },
  rewardTitle: { fontFamily: Font.semiBold, fontSize: FontSize.base, color: Colors.textPrimary },
  rewardSub: { fontFamily: Font.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  pointsBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  pointsBadgeLocked: { backgroundColor: Colors.borderSubtle },
  pointsBadgeText: { fontFamily: Font.bold, fontSize: FontSize.sm, color: Colors.primary },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingBottom: 40, gap: 8 },
  emptyTitle: { fontFamily: Font.displayBold, fontSize: FontSize.xl, color: Colors.textPrimary },
  emptyBody: { fontFamily: Font.regular, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', maxWidth: 280 },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: Colors.overlayHeavy },
  overlayTablet: { alignItems: 'center' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'], paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontFamily: Font.displayBold, fontSize: FontSize.xl, color: Colors.textPrimary, marginBottom: 20 },
  fieldLabel: { fontFamily: Font.medium, fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 10, marginTop: 16 },
  emojiRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  emojiBtn: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.borderSubtle, borderWidth: 1.5, borderColor: Colors.border },
  emojiBtnSelected: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
})
