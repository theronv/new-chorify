import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { members as membersApi } from '@/lib/api'
import { useAuthStore, useHouseholdStore } from '@/lib/store'
import { MemberAvatar } from '@/components/MemberAvatar'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'
import { useLayout } from '@/constants/layout'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { contentPadding, headerPadding, contentMaxWidth } = useLayout()

  const memberId    = useAuthStore((s) => s.memberId)
  const logout      = useAuthStore((s) => s.logout)
  const household   = useHouseholdStore((s) => s.household)
  const members     = useHouseholdStore((s) => s.members)

  const me           = members.find((m) => m.id === memberId)
  const updateMember = useHouseholdStore((s) => s.updateMember)

  const [loggingOut,    setLoggingOut]    = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  async function handleShare() {
    if (!household?.invite_code) return
    await Share.share({
      message: `Join our household on Keptt! Invite code: ${household.invite_code}`,
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
              <Text style={styles.profilePoints}>{me?.points_total ?? 0} points earned</Text>
              <Text style={styles.profilePhotoHint}>Tap photo to change</Text>
            </View>
          </View>
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
            <Text style={styles.navRowText}>Browse Packs</Text>
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
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000',
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
    color:      '#fff',
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

  // Nav row (for Browse Packs etc.)
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
  navRowChevron: {
    fontFamily: Font.regular,
    fontSize:   FontSize.xl,
    color:      Colors.textTertiary,
    lineHeight: 22,
  },
})
