import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'

interface ToastProps {
  message: string
  type?: 'error' | 'success' | 'info'
  visible: boolean
  onHide: () => void
}

const BG: Record<NonNullable<ToastProps['type']>, string> = {
  error:   Colors.danger,
  success: Colors.success,
  info:    Colors.primary,
}

export function Toast({ message, type = 'error', visible, onHide }: ToastProps) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(120)).current

  useEffect(() => {
    if (!visible) return

    // Slide up
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start()

    const timer = setTimeout(() => {
      // Slide down then hide
      Animated.timing(translateY, {
        toValue: 120,
        duration: 250,
        useNativeDriver: true,
      }).start(onHide)
    }, 3000)

    return () => clearTimeout(timer)
  }, [visible, message])

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: BG[type], bottom: insets.bottom + 16 },
        { transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    fontFamily: Font.medium,
    fontSize: FontSize.base,
    color: '#fff',
    textAlign: 'center',
  },
})
