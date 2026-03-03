import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import * as SecureStore from 'expo-secure-store'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { members as membersApi, households as householdsApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore, setStoreTimezone, getTodayString } from '@/lib/store'
import { getTimezone, saveTimezone, TIMEZONES, DEFAULT_TIMEZONE } from '@/lib/timezone'
import {
  getNotifPref,
  saveNotifPref,
  scheduleDailySummary,
  cancelDailySummary,
  registerForPushNotificationsAsync,
  PUSH_TOKEN_CACHE_KEY,
  type NotificationPref,
} from '@/lib/notifications'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { MemberAvatar } from '@/components/MemberAvatar'
import { Toast } from '@/components/Toast'
import { Colors, Radius } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'

const PERSON_EMOJIS = [
  '😀', '😊', '😎', '🥳', '🤩', '😇', '🤓', '🤗',
  '🧒', '👦', '👧', '👨', '👩', '🧑', '👴', '👵',
  '🦸', '🧙', '⭐', '🐾',
]

const NOTIF_OPTIONS: { value: NotificationPref; label: string; desc: string }[] = [
  { value: 'task',  label: 'When tasks are due', desc: 'Push notification for each task'        },
  { value: 'daily', label: 'Daily summary',       desc: 'One notification with task count at 8am' },
  { value: 'none',  label: 'Off',                 desc: 'No notifications'                        },
]

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { isLandscape, contentPadding, headerPadding, contentMaxWidth, sheetMaxWidth } = useLayout()

  const memberId    = useAuthStore((s) => s.memberId)
  const householdId = useAuthStore((s) => s.householdId)
  const logout      = useAuthStore((s) => s.logout)
  const household   = useHouseholdStore((s) => s.household)
  const members     = useHouseholdStore((s) => s.members)
  const tasks       = useHouseholdStore((s) => s.tasks)
  const completions = useHouseholdStore((s) => s.completions)

  const me           = members.find((m) => m.id === memberId)
  const updateMember = useHouseholdStore((s) => s.updateMember)
  const addMember    = useHouseholdStore((s) => s.addMember)

  const [loggingOut,       setLoggingOut]       = useState(false)
  const [uploadingPhoto,   setUploadingPhoto]   = useState(false)
  const [notifPref,        setNotifPref]        = useState<NotificationPref>('task')
  const [timezone,         setTimezone]         = useState<string>(DEFAULT_TIMEZONE)
  const [tzPickerOpen,     setTzPickerOpen]     = useState(false)

  // Add Member sheet state
  const [memberSheetVisible, setMemberSheetVisible] = useState(false)
  const [displayName,        setDisplayName]        = useState('')
  const [emoji,              setEmoji]              = useState('🧒')
  const [isChild,            setIsChild]            = useState(true)
  const [memberLoading,      setMemberLoading]      = useState(false)
  const [memberError,        setMemberError]        = useState<string | null>(null)

  useEffect(() => {
    getNotifPref().then(setNotifPref)
    getTimezone().then(setTimezone)
  }, [])

  // Count of tasks due or overdue today (not yet completed) — used when scheduling daily summary
  const today    = getTodayString()
  const dueCount = tasks.filter((t) => {
    if (!t.next_due || t.next_due > today) return false
    return !completions.some((c) => c.task_id === t.id && c.completed_date === today)
  }).length

  async function handleShare() {
    if (!household?.invite_code) return
    await Share.share({
      message: `Join our household on Chorify! Invite code: ${household.invite_code}`,
    })
  }

  async function handlePickPhoto() {
    if (!memberId || !me) return

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access in Settings to set a profile photo.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    })

    if (result.canceled) return

    setUploadingPhoto(true)
    try {
      // Resize to 200×200 and compress to ~50KB
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 200, height: 200 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      )

      if (!manipulated.base64) throw new Error('Image conversion failed')

      const avatarUrl = `data:image/jpeg;base64,${manipulated.base64}`
      await membersApi.update(memberId, { avatarUrl })
      updateMember(memberId, { avatar_url: avatarUrl })
    } catch {
      Alert.alert('Upload failed', 'Could not save your photo. Please try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleNotifPref(pref: NotificationPref) {
    if (pref === notifPref) return
    setNotifPref(pref)
    await saveNotifPref(pref)

    if (pref === 'task') {
      await cancelDailySummary()
      const token = await registerForPushNotificationsAsync()
      if (token && memberId) {
        try {
          const cached = await SecureStore.getItemAsync(PUSH_TOKEN_CACHE_KEY)
          if (token !== cached) {
            await membersApi.update(memberId, { pushToken: token })
            await SecureStore.setItemAsync(PUSH_TOKEN_CACHE_KEY, token)
            updateMember(memberId, { push_token: token })
          }
        } catch {}
      }
    } else {
      // Clear push token from server so it stops receiving push notifications
      try {
        const cached = await SecureStore.getItemAsync(PUSH_TOKEN_CACHE_KEY)
        if (cached && memberId) {
          await membersApi.update(memberId, { pushToken: null })
          await SecureStore.deleteItemAsync(PUSH_TOKEN_CACHE_KEY)
          updateMember(memberId, { push_token: null })
        }
      } catch {}

      if (pref === 'daily') {
        await scheduleDailySummary(dueCount)
      } else {
        await cancelDailySummary()
      }
    }
  }

  async function handleTimezone(tz: string) {
    setTimezone(tz)
    setTzPickerOpen(false)
    await saveTimezone(tz)
    setStoreTimezone(tz)
  }

  function resetMemberSheet() {
    setDisplayName('')
    setEmoji('🧒')
    setIsChild(true)
    setMemberError(null)
  }

  function closeMemberSheet() {
    resetMemberSheet()
    setMemberSheetVisible(false)
  }

  async function handleSaveMember() {
    if (!displayName.trim() || !householdId) return
    setMemberLoading(true)
    setMemberError(null)
    try {
      const { member } = await householdsApi.addMember(householdId, {
        displayName: displayName.trim(),
        emoji,
      })
      addMember(member)
      closeMemberSheet()
    } catch (e: unknown) {
      const msg =
        e instanceof Error                      ? e.message
        : typeof e === 'string'                 ? e
        : typeof (e as any)?.error === 'string' ? (e as any).error
        : 'Could not add member. Try again.'
      setMemberError(msg)
    } finally {
      setMemberLoading(false)
    }
  }

  function confirmLogout() {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true)
            try {
              await logout()
              router.replace('/(auth)/login')
            } finally {
              setLoggingOut(false)
            }
          },
        },
      ],
    )
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingLeft: headerPadding + insets.left, paddingRight: headerPadding + insets.right }]}>
        <Text style={styles.screenTitle}>Settings</Text>
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
        showsVerticalScrollIndicator={false}
      >
        {/* ── Household ──────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Household</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Name</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {household?.name ?? '—'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowLabel}>Invite code</Text>
              <Text style={styles.inviteCode}>{household?.invite_code ?? '—'}</Text>
            </View>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {members.map((member, idx) => (
            <View key={member.id}>
              {idx > 0 && <View style={styles.divider} />}
              <View style={styles.memberRow}>
                <MemberAvatar member={member} size={36} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.display_name}
                  </Text>
                  {member.is_child === 1 && (
                    <Text style={styles.memberSub}>Child</Text>
                  )}
                </View>
              </View>
            </View>
          ))}

          {members.length > 0 && <View style={styles.divider} />}
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => setMemberSheetVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addMemberText}>Add Member</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Profile ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Your profile</Text>
        <View style={styles.section}>
          <View style={styles.profileRow}>
            <TouchableOpacity
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
              activeOpacity={0.8}
              style={styles.avatarWrapper}
            >
              {me && <MemberAvatar member={me} size={52} />}
              {uploadingPhoto && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
              {!uploadingPhoto && (
                <View style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>✎</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{me?.display_name ?? '—'}</Text>
              <Text style={styles.profilePhotoHint}>Tap photo to change</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => setTzPickerOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.navRowText}>Time Zone</Text>
              <Text style={styles.navRowSub}>
                {TIMEZONES.find((t) => t.value === timezone)?.label ?? timezone}
              </Text>
            </View>
            <Text style={styles.navRowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Tasks ──────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Tasks</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push('/(app)/settings/rooms' as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.navRowText}>Manage Rooms</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push('/(app)/settings/categories' as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.navRowText}>Manage Categories</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push('/(app)/settings/packs' as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.navRowText}>Add from Task Packs</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push('/(app)/settings/csv' as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.navRowText}>Import / Export Tasks</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </TouchableOpacity>

        </View>

        {/* ── Notifications ──────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.section}>
          {NOTIF_OPTIONS.map((opt, idx) => (
            <View key={opt.value}>
              {idx > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={styles.notifRow}
                onPress={() => handleNotifPref(opt.value)}
                activeOpacity={0.7}
              >
                <View style={styles.notifInfo}>
                  <Text style={styles.notifLabel}>{opt.label}</Text>
                  <Text style={styles.notifDesc}>{opt.desc}</Text>
                </View>
                {notifPref === opt.value && (
                  <Text style={styles.notifCheck}>✓</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Account ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutRow}
            onPress={confirmLogout}
            disabled={loggingOut}
            activeOpacity={0.7}
          >
            <Text style={styles.signOutText}>
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Timezone picker */}
      <Modal
        visible={tzPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTzPickerOpen(false)}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.pickerBackdrop]}
          onPress={() => setTzPickerOpen(false)}
        />
        <View style={styles.pickerWrapper} pointerEvents="box-none">
          <View style={[styles.pickerPopup, { maxWidth: contentMaxWidth ?? 480 }]}>
            <Text style={styles.pickerTitle}>Time Zone</Text>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {TIMEZONES.map((tz, idx) => {
                const selected = timezone === tz.value
                return (
                  <View key={tz.value}>
                    {idx > 0 && <View style={styles.pickerDivider} />}
                    <TouchableOpacity
                      style={[styles.pickerOption, selected && styles.pickerOptionSelected]}
                      onPress={() => handleTimezone(tz.value)}
                      activeOpacity={0.65}
                    >
                      <View style={styles.pickerOptionBody}>
                        <Text style={[styles.pickerOptionLabel, selected && styles.pickerOptionLabelSelected]}>
                          {tz.label}
                        </Text>
                        {tz.city ? (
                          <Text style={styles.pickerOptionSub}>{tz.city}</Text>
                        ) : null}
                      </View>
                      {selected && <Text style={styles.pickerCheck}>✓</Text>}
                    </TouchableOpacity>
                  </View>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Member Sheet */}
      <Modal
        visible={memberSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMemberSheet}
        statusBarTranslucent
      >
        <View style={[styles.overlay, sheetMaxWidth && styles.overlayTablet]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMemberSheet} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.kavContainer, sheetMaxWidth && { maxWidth: sheetMaxWidth }]}
          >
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16, ...(isLandscape ? { maxHeight: '95%' } : {}) }]}>
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

                <View style={styles.toggleRow}>
                  <View style={styles.toggleText}>
                    <Text style={styles.toggleTitle}>Child account</Text>
                    <Text style={styles.toggleSub}>
                      {isChild
                        ? 'No email or login needed'
                        : 'Adults join via the invite code above'}
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
                  onPress={handleSaveMember}
                  loading={memberLoading}
                  disabled={!displayName.trim() || !isChild || memberLoading}
                  style={styles.saveBtn}
                />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>

        <Toast
          message={memberError ?? ''}
          type="error"
          visible={memberError !== null}
          onHide={() => setMemberError(null)}
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  sectionLabel: {
    fontFamily:    Font.semiBold,
    fontSize:      FontSize.xs,
    color:         Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  8,
    marginTop:     20,
    paddingLeft:   4,
  },

  section: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    overflow:        'hidden',
    shadowColor:     Colors.textPrimary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.05,
    shadowRadius:    8,
    elevation:       2,
  },

  // Standard key–value row
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  rowLeft: { flex: 1 },
  rowLabel: {
    fontFamily: Font.medium,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    marginBottom: 2,
  },
  rowValue: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
    maxWidth:   '60%',
    textAlign:  'right',
  },

  divider: {
    height:     StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },

  // Invite code
  inviteCode: {
    fontFamily:    Font.displayBold,
    fontSize:      FontSize.xl,
    color:         Colors.primary,
    letterSpacing: 4,
  },
  shareBtn: {
    backgroundColor:   Colors.primaryLight,
    borderRadius:      10,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  shareBtnText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.sm,
    color:      Colors.primary,
  },

  // Profile
  profileRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       16,
    gap:           14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarOverlay: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius:    26,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  editBadge: {
    position:        'absolute',
    bottom:          -2,
    right:           -2,
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     Colors.surface,
  },
  editBadgeText: {
    fontSize:   10,
    color:      Colors.textOnPrimary,
    lineHeight: 14,
  },
  profileInfo:   { flex: 1 },
  profileName: {
    fontFamily:  Font.semiBold,
    fontSize:    FontSize.base,
    color:       Colors.textPrimary,
    marginBottom: 2,
  },
  profilePoints: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  profilePhotoHint: {
    fontFamily: Font.regular,
    fontSize:   FontSize.xs,
    color:      Colors.textTertiary,
    marginTop:  2,
  },

  // Sign out
  signOutRow: {
    paddingHorizontal: 16,
    paddingVertical:   16,
    alignItems:        'center',
  },
  signOutText: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.danger,
  },

  // Nav row
  navRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   16,
  },
  navRowText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
  },
  navRowSub: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    marginTop:  1,
  },
  navRowChevron: {
    fontFamily: Font.regular,
    fontSize:   FontSize.xl,
    color:      Colors.textTertiary,
    lineHeight: 22,
  },

  // Timezone picker modal
  pickerBackdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerWrapper: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 32,
  },
  pickerPopup: {
    width:           '100%',
    backgroundColor: Colors.surface,
    borderRadius:    Radius.xl,
    paddingTop:      8,
    paddingBottom:   8,
    maxHeight:       '70%',
    shadowColor:     Colors.textPrimary,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.15,
    shadowRadius:    24,
    elevation:       16,
  },
  pickerTitle: {
    fontFamily:        Font.semiBold,
    fontSize:          FontSize.sm,
    color:             Colors.textSecondary,
    textTransform:     'uppercase',
    letterSpacing:     0.8,
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  pickerDivider: {
    height:     StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  pickerOption: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   13,
    marginHorizontal:  6,
    borderRadius:      Radius.md,
  },
  pickerOptionSelected: { backgroundColor: Colors.primaryLight },
  pickerOptionBody: { flex: 1 },
  pickerOptionLabel: {
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
  },
  pickerOptionLabelSelected: { color: Colors.primary },
  pickerOptionSub: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    marginTop:  1,
  },
  pickerCheck: {
    fontFamily: Font.bold,
    fontSize:   FontSize.base,
    color:      Colors.primary,
    marginLeft: 8,
  },

  // Family member row
  memberRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 16,
    paddingVertical:   12,
  },
  memberInfo: { flex: 1 },
  memberName: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
  },
  memberSub: {
    fontFamily: Font.regular,
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
    marginTop:  1,
  },
  addMemberText: {
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.primary,
  },

  // Add Member sheet
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  overlayTablet: { alignItems: 'center' },
  kavContainer:  { width: '100%' },
  sheet: {
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingHorizontal:    20,
    paddingTop:           12,
    maxHeight:            '85%',
    shadowColor:          Colors.textPrimary,
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
  emojiRow: { flexDirection: 'row', gap: 8, paddingBottom: 4, marginBottom: 20 },
  emojiBtn: {
    width: 44, height: 44, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.borderSubtle,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  emojiBtnSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor:     Colors.primary,
  },
  emojiOpt: { fontSize: 24 },
  toggleRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: Colors.borderSubtle,
    borderRadius:    Radius.lg,
    padding:         14,
    marginBottom:    20,
  },
  toggleText:  { flex: 1, marginRight: 12 },
  toggleTitle: {
    fontFamily: Font.semiBold,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
  },
  toggleSub: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    marginTop:  2,
  },
  saveBtn: { marginTop: 4 },

  // Notification preference rows
  notifRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               12,
  },
  notifInfo: {
    flex: 1,
    gap:  3,
  },
  notifLabel: {
    fontFamily: Font.medium,
    fontSize:   FontSize.base,
    color:      Colors.textPrimary,
  },
  notifDesc: {
    fontFamily: Font.regular,
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  notifCheck: {
    fontFamily: Font.bold,
    fontSize:   FontSize.base,
    color:      Colors.primary,
    width:      20,
    textAlign:  'right',
  },
})
