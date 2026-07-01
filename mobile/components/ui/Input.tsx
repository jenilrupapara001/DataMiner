/**
 * RetailOps Partner — Input Component
 *
 * Enterprise-grade text input with label, validation, and icons.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Eye, EyeOff, Check, AlertCircle } from 'lucide-react-native';

interface InputProps extends TextInputProps {
  /** Label text above input */
  label: string;
  /** Error message to display */
  error?: string;
  /** Success message to display */
  success?: string;
  /** Whether to show success state */
  isSuccess?: boolean;
  /** Leading icon component */
  leadingIcon?: React.ComponentType<{ size: number; color: string }>;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Helper text below input */
  helperText?: string;
}

export function Input({
  label,
  error,
  success,
  isSuccess,
  leadingIcon: LeadingIcon,
  disabled,
  helperText,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const focusAnim = useAnimatedStyle(() => ({
    borderColor: error
      ? '#DC2626'
      : isSuccess
      ? '#16A34A'
      : isFocused
      ? '#2563EB'
      : '#E2E8F0',
    shadowColor: isFocused ? '#2563EB' : 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isFocused ? 0.1 : 0,
    shadowRadius: isFocused ? 8 : 0,
    elevation: isFocused ? 4 : 0,
  }));

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const isPassword = props.secureTextEntry;

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={[styles.label, disabled && styles.labelDisabled]}>
        {label}
      </Text>

      {/* Input Container */}
      <Animated.View style={[styles.inputContainer, focusAnim, disabled && styles.disabled]}>
        {/* Leading Icon */}
        {LeadingIcon && (
          <View style={styles.leadingIcon}>
            <LeadingIcon size={20} color={isFocused ? '#2563EB' : '#94A3B8'} />
          </View>
        )}

        {/* Text Input */}
        <TextInput
          style={[
            styles.input,
            LeadingIcon && styles.inputWithIcon,
            isPassword && styles.inputWithTrailing,
            disabled && styles.inputDisabled,
          ]}
          placeholderTextColor="#94A3B8"
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword && !isPasswordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />

        {/* Trailing Icon (password toggle or validation) */}
        {isPassword && (
          <Pressable
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.trailingIcon}
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            {isPasswordVisible ? (
              <EyeOff size={20} color="#64748B" />
            ) : (
              <Eye size={20} color="#64748B" />
            )}
          </Pressable>
        )}

        {/* Success Icon */}
        {isSuccess && !isPassword && (
          <View style={styles.trailingIcon}>
            <Check size={20} color="#16A34A" />
          </View>
        )}

        {/* Error Icon */}
        {error && !isPassword && (
          <View style={styles.trailingIcon}>
            <AlertCircle size={20} color="#DC2626" />
          </View>
        )}
      </Animated.View>

      {/* Error Message */}
      {error && (
        <View style={styles.messageContainer}>
          <AlertCircle size={14} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Success Message */}
      {success && !error && (
        <View style={styles.messageContainer}>
          <Check size={14} color="#16A34A" />
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}

      {/* Helper Text */}
      {helperText && !error && !success && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
    marginBottom: 8,
  },
  labelDisabled: {
    color: '#94A3B8',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  disabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.6,
  },
  leadingIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
    height: '100%',
  },
  inputWithIcon: {
    marginLeft: 0,
  },
  inputWithTrailing: {
    paddingRight: 48,
  },
  inputDisabled: {
    color: '#94A3B8',
  },
  trailingIcon: {
    marginLeft: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
  },
  successText: {
    fontSize: 12,
    color: '#16A34A',
  },
  helperText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
});
