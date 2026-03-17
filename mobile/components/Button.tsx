import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
  type ViewStyle,
} from 'react-native'
import { Colors, Radius, Shadows } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'

interface ButtonProps extends TouchableOpacityProps {
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
  style?: ViewStyle
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = true,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? Colors.textOnPrimary : Colors.primary}
        />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label`], styles[`${size}Label`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  fullWidth: {
    width: '100%',
  },

  // Variants
  primary: {
    backgroundColor: Colors.primary,
    ...Shadows.button,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },

  // Sizes
  sm: { height: 38, paddingHorizontal: 16 },
  md: { height: 52, paddingHorizontal: 20 },
  lg: { height: 58, paddingHorizontal: 24 },

  // State
  disabled: { opacity: 0.45 },

  // Labels (base)
  label: {
    fontFamily: Font.semiBold,
    letterSpacing: 0.1,
  },
  primaryLabel:   { color: Colors.textOnPrimary },
  secondaryLabel: { color: Colors.primary },
  ghostLabel:     { color: Colors.primary },

  // Label sizes
  smLabel:  { fontSize: FontSize.sm },
  mdLabel:  { fontSize: FontSize.base },
  lgLabel:  { fontSize: FontSize.md },
})
