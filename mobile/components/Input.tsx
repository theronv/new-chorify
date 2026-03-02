import React, { forwardRef, useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native'
import { Colors } from '@/constants/colors'
import { Font, FontSize } from '@/constants/fonts'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  containerStyle?: ViewStyle
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, containerStyle, style, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false)

    return (
      <View style={containerStyle}>
        {label ? <Text style={styles.label}>{label}</Text> : null}

        <TextInput
          ref={ref}
          style={[
            styles.input,
            focused && styles.inputFocused,
            error ? styles.inputError : null,
            style,
          ]}
          placeholderTextColor={Colors.textTertiary}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          {...props}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    )
  },
)

Input.displayName = 'Input'

const styles = StyleSheet.create({
  label: {
    fontFamily: Font.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    fontFamily: Font.regular,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  inputFocused: {
    borderColor: Colors.primary,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  error: {
    fontFamily: Font.regular,
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: 4,
    marginLeft: 4,
  },
})
