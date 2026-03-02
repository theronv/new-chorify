import { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { households as householdsApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { MemberAvatar } from '@/components/MemberAvatar'
import { Toast } from '@/components/Toast'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import type { Completion } from '@/types'

// ── Static data ───────────────────────────────────────────────────────────────

const PERSON_EMOJIS = [
  '😀', '😊', '😎', '🥳', '🤩', '😇', '🤓', '🤗',
  '🧒', '👦', '👧', '👨', '👩', '🧑', '👴', '👵',
  '🦸', '🧙', '⭐', '🐾',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function weeklyPoints(memberId: string, completions: Completion[]): number {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return completions
    .filter((c) => c.member_id === memberId && c.completed_date >= cutoffStr)
    .reduce((sum, c) => sum + c.points, 0)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FamilyScreen() {
  const insets = useSafeAreaInsets()

  const householdId = useAuthStore((s) => s.householdId)
  const members     = useHouseholdStore((s) => s.members)
  const completions = useHouseholdStore((s) => s.completions)
  const isLoading   = useHouseholdStore((s) => s.isLoading)
  const load        = useHouseholdStore((s) => s.load)
  const addMember   = useHouseholdStore((s) => s.addMember)

  const [sheetVisible, setSheetVisible] = useState(false)
  const [displayName, setDisplayName]   = useState('')
  const [emoji, setEmoji]               = useState('🧒')
  const [isChild, setIsChild]           = useState(true)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // Sorted leaderboard: highest all-time points first
  const sorted = [...members].sort((a, b) => b.points_total - a.points_total)

  function resetSheet() {
    setDisplayName('')
    setEmoji('🧒')
    setIsChild(true)
    setError(null)
  }

  function closeSheet() {
    resetSheet()
    setSheetVisible(false)
  }

  async function handleSave() {
    if (!displayName.trim() || !householdId) return
    setLoading(true)
    setError(null)
    try {
      const { member } = await householdsApi.addMember(householdId, {
        displayName: displayName.trim(),
        emoji,
      })
      addMember(member)
      closeSheet()
    } catch (e: unknown) {
      const msg =
        e instanceof Error                      ? e.message
        : typeof e === 'string'                 ? e
        : typeof (e as any)?.error === 'string' ? (e as any).error
        : 'Could not add member. Try again.'
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
        <Text style={styles.screenTitle}>Family</Text>
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
        {sorted.map((member, i) => {
          const wpts  = weeklyPoints(member.id, completions)
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

          return (
            <View key={member.id} style={styles.card}>
              {/* Rank medal */}
              <View style={styles.rankCol}>
                {medal
                  ? <Text style={styles.medal}>{medal}</Text>
                  : <Text style={styles.rankNum}>#{i + 1}</Text>}
              </View>

              {/* Avatar */}
              <MemberAvatar member={member} size={46} />

              {/* Name + points */}
              <View style={styles.cardBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.display_name}
                  </Text>
                  {member.is_child === 1 && (
                    <View style={styles.childBadge}>
                      <Text style={styles.childBadgeText}>Child</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.pointsSub}>
                  {wpts} pts this week
                </Text>
              </View>

              {/* All-time total */}
              <View style={styles.totalCol}>
                <Text style={styles.totalPoints}>{member.points_total}</Text>
                <Text style={styles.totalLabel}>total</Text>
              </View>
            </View>
          )
        })}

        {members.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👨‍👩‍👧</Text>
            <Text style={styles.emptyTitle}>Just you so far</Text>
            <Text style={styles.emptyBody}>Add family members to share chores and track points.</Text>
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

      {/* Add Member Sheet */}
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
              <Text style={styles.sheetTitle}>Add Family Member</Text>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.formScroll}
              >
                <Input
                  label="Name"
                  placeholder="e.g. Emma"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
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
                  {PERSON_EMOJIS.map((e) => (
                    <TouchableOpacity
                      key={e}
                      onPress={() => setEmoji(e)}
                      style={[styles.emojiBtn, emoji === e && styles.emojiBtnSelected]}
                    >
                      <Text style={styles.emojiOpt}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Child account toggle */}
                <View style={styles.toggleRow}>
                  <View style={styles.toggleText}>
                    <Text style={styles.toggleTitle}>Child account</Text>
                    <Text style={styles.toggleSub}>
                      {isChild
                        ? 'No email or login needed'
                        : 'Adults join via the invite code in Settings'}
                    </Text>
                  </View>
                  <Switch
                    value={isChild}
                    onValueChange={setIsChild}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.surface}
                  />
                </View>

                <Button
                  label="Add Member"
                  onPress={handleSave}
                  loading={loading}
                  disabled={!displayName.trim() || !isChild || loading}
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

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Member card
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surface,
    borderRadius:    16,
    marginBottom:    10,
    padding:         14,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
    gap:             12,
  },
  rankCol: {
    width:          24,
    alignItems:     'center',
  },
  medal: { fontSize: 20 },
  rankNum: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.sm,
    color:      Colors.textTertiary,
  },
  cardBody: {
    flex: 1,
    gap:  2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    flexWrap:      'wrap',
  },
  memberName: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
  },
  childBadge: {
    backgroundColor:   Colors.borderSubtle,
    borderRadius:      8,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  childBadgeText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
  },
  pointsSub: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  totalCol: {
    alignItems: 'flex-end',
  },
  totalPoints: {
    fontFamily: Font.displayBold,
    fontSize:   FontSize.xl,
    color:      Colors.primary,
  },
  totalLabel: {
    fontFamily: Font.regular,
    fontSize:   FontSize.xs,
    color:      Colors.textTertiary,
  },

  // Empty
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingTop:     80,
    gap:            8,
  },
  emptyEmoji:  { fontSize: 52, marginBottom: 8 },
  emptyTitle:  { fontFamily: Font.displayBold, fontSize: FontSize.xl, color: Colors.textPrimary },
  emptyBody:   { fontFamily: Font.regular, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', maxWidth: 240 },

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
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  kavContainer: { width: '100%' },
  sheet: {
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal:    20,
    paddingTop:           12,
    maxHeight:            '85%',
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
    fontFamily: Font.displayBold, fontSize: FontSize.xl,
    color: Colors.textPrimary, marginBottom: 16,
  },
  formScroll: { paddingBottom: 8 },
  field: { marginBottom: 20 },
  fieldLabel: {
    fontFamily: Font.medium, fontSize: FontSize.sm,
    color: Colors.textSecondary, marginBottom: 10,
  },

  // Emoji picker
  emojiRow: { flexDirection: 'row', gap: 8, paddingBottom: 4, marginBottom: 20 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.borderSubtle,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  emojiBtnSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor:     Colors.primary,
  },
  emojiOpt: { fontSize: 24 },

  // Toggle
  toggleRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: Colors.borderSubtle,
    borderRadius:    14,
    padding:         14,
    marginBottom:    20,
  },
  toggleText: { flex: 1, marginRight: 12 },
  toggleTitle: {
    fontFamily: Font.semiBold, fontSize: FontSize.base, color: Colors.textPrimary,
  },
  toggleSub: {
    fontFamily: Font.regular, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2,
  },

  saveBtn: { marginTop: 4 },
})
