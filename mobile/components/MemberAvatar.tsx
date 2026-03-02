import { Image, StyleSheet, Text, View } from 'react-native'
import { Colors } from '@/constants/colors'
import type { Member } from '@/types'

interface Props {
  member: Pick<Member, 'emoji' | 'avatar_url' | 'display_name'>
  size?: number
}

/**
 * Displays a member's avatar.
 * Priority: avatar_url (base64 photo) → emoji fallback.
 */
export function MemberAvatar({ member, size = 46 }: Props) {
  const radius = size / 2
  const emojiSize = Math.round(size * 0.56)

  if (member.avatar_url) {
    return (
      <Image
        source={{ uri: member.avatar_url }}
        style={[styles.photo, { width: size, height: size, borderRadius: radius }]}
        accessibilityLabel={member.display_name}
      />
    )
  }

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text style={{ fontSize: emojiSize }}>{member.emoji}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: Colors.primaryLight,
    alignItems:      'center',
    justifyContent:  'center',
  },
  photo: {
    resizeMode: 'cover',
  },
})
