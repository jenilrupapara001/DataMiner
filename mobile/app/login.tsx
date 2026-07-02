/**
 * RetailOps Partner — Login Screen
 *
 * Enterprise-grade OTP login for seller operations platform.
 * Screen 1 of the authentication flow.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  cancelAnimation,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import {
  Mail,
  ArrowRight,
  ShieldCheck,
  Box,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Check,
} from 'lucide-react-native';
import { authService, ApiError } from '@/services';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 380;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ============================================================
// SPINNING LOADER
// ============================================================

function SpinningLoader({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Loader2 size={size} color={color} />
    </Animated.View>
  );
}

// ============================================================
// ANIMATED INPUT
// ============================================================

interface AnimatedInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  placeholder: string;
  keyboardType?: 'email-address' | 'default';
  error?: string | null;
  success?: boolean;
  disabled?: boolean;
  inputRef?: React.Ref<TextInput>;
  returnKeyType?: 'next' | 'done' | 'go';
}

function AnimatedInput({
  label,
  value,
  onChangeText,
  onFocus,
  onBlur,
  onSubmitEditing,
  placeholder,
  keyboardType = 'default',
  error,
  success,
  disabled,
  inputRef,
  returnKeyType = 'next',
}: AnimatedInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Shared values driven by props/state
  const focusProgress = useSharedValue(0);
  const errorProgress = useSharedValue(0);
  const successProgress = useSharedValue(0);

  useEffect(() => {
    focusProgress.value = withTiming(isFocused ? 1 : 0, { duration: 220 });
  }, [isFocused, focusProgress]);

  useEffect(() => {
    errorProgress.value = withTiming(error ? 1 : 0, { duration: 220 });
  }, [error, errorProgress]);

  useEffect(() => {
    successProgress.value = withTiming(success ? 1 : 0, { duration: 220 });
  }, [success, successProgress]);

  // Smooth colour transitions using interpolateColor (works on UI thread)
  const containerAnimatedStyle = useAnimatedStyle(() => {
    // Priority: error > success > focused > default
    const borderColor = interpolateColor(
      errorProgress.value,
      [0, 1],
      [
        interpolateColor(
          successProgress.value,
          [0, 1],
          [
            interpolateColor(
              focusProgress.value,
              [0, 1],
              ['#E2E8F0', '#2563EB']
            ),
            '#16A34A',
          ]
        ),
        '#DC2626',
      ]
    );

    return {
      borderColor,
      shadowOpacity: interpolate(
        focusProgress.value,
        [0, 1],
        [0, 0.15],
        Extrapolation.CLAMP
      ),
      shadowRadius: interpolate(
        focusProgress.value,
        [0, 1],
        [0, 12],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            focusProgress.value,
            [0, 1],
            [1, 1.005],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  // Icon colour — computed from JS state (icon component's `color` prop is static)
  const iconColor = error ? '#DC2626' : isFocused ? '#2563EB' : '#94A3B8';

  return (
    <View style={inputStyles.container}>
      <View style={inputStyles.labelRow}>
        <Text style={[inputStyles.label, disabled && { color: '#94A3B8' }]}>
          {label}
        </Text>
        {error && (
          <Animated.View entering={FadeIn.duration(200)}>
            <Text style={inputStyles.errorLabel}>Required</Text>
          </Animated.View>
        )}
      </View>

      <Animated.View style={[inputStyles.inputContainer, containerAnimatedStyle]}>
        <View style={inputStyles.iconContainer}>
          <Mail size={18} color={iconColor} />
        </View>

        <TextInput
          ref={inputRef}
          style={[inputStyles.input, disabled && { color: '#94A3B8' }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
          returnKeyType={returnKeyType}
        />

        {success && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={inputStyles.trailingIcon}
          >
            <CheckCircle2 size={18} color="#16A34A" />
          </Animated.View>
        )}

        {error && !success && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={inputStyles.trailingIcon}
          >
            <AlertCircle size={18} color="#DC2626" />
          </Animated.View>
        )}
      </Animated.View>

      {error && (
        <Animated.View
          style={inputStyles.errorContainer}
          entering={FadeIn.duration(200)}
        >
          <AlertCircle size={12} color="#DC2626" />
          <Text style={inputStyles.errorText}>{error}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  container: { marginBottom: 20 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: { fontSize: 14, fontWeight: '500', color: '#0F172A' },
  errorLabel: { fontSize: 12, fontWeight: '500', color: '#DC2626' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    // shadow — animated
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  iconContainer: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    height: '100%',
    ...(Platform.OS === 'android' && { padding: 0 }),
  },
  trailingIcon: { marginLeft: 12 },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: { fontSize: 12, color: '#DC2626', fontWeight: '500' },
});

// ============================================================
// ANIMATED CHECKBOX
// ============================================================

interface AnimatedCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function AnimatedCheckbox({ checked, onToggle, disabled }: AnimatedCheckboxProps) {
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, { duration: 180 });
    if (checked) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 120 }),
        withSpring(1, { damping: 10, stiffness: 300 })
      );
    }
  }, [checked, progress, scale]);

  const boxStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      ['#FFFFFF', '#2563EB']
    );
    const borderColor = interpolateColor(
      progress.value,
      [0, 1],
      ['#CBD5E1', '#2563EB']
    );
    return {
      backgroundColor,
      borderColor,
      transform: [{ scale: scale.value }],
    };
  });

  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [0.4, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      hitSlop={8}
      style={styles.checkboxTouchArea}
    >
      <Animated.View style={[styles.checkbox, boxStyle]}>
        <Animated.View style={checkStyle}>
          <Check size={13} color="#FFFFFF" strokeWidth={3.5} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ============================================================
// ANIMATED PROGRESS BAR (indeterminate)
// ============================================================

function IndeterminateProgressBar() {
  const translateX = useSharedValue(-100);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(300, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
    return () => cancelAnimation(translateX);
  }, [translateX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.progressBar}>
      <Animated.View style={[styles.progressBarFill, style]} />
    </View>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  const emailRef = useRef<TextInput>(null);

  // Button press animation
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  const validateEmail = useCallback((value: string): string | null => {
    if (!value.trim()) return 'Email address is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Please enter a valid email address';
    return null;
  }, []);

  const handleEmailChange = useCallback(
    (text: string) => {
      setEmail(text);
      setEmailError(null);
      setGeneralError(null);
      setIsEmailValid(text.trim() ? !validateEmail(text) : false);
    },
    [validateEmail]
  );

  const handleEmailBlur = useCallback(() => {
    if (email.trim()) {
      setEmailError(validateEmail(email));
    }
  }, [email, validateEmail]);

  const handleSubmit = useCallback(async () => {
    const emailErr = validateEmail(email);
    setEmailError(emailErr);
    if (emailErr) return;

    if (!isAgreed) {
      setGeneralError('Please agree to the terms and conditions');
      return;
    }

    setIsLoading(true);
    setGeneralError(null);

    try {
      const response = await authService.requestOtp(email);

      if (response.requiresOtp && response.tempToken) {
        router.push({
          pathname: '/otp',
          params: {
            tempToken: response.tempToken,
            destination: response.destination || email,
            expiresIn: response.expiresIn?.toString() || '300',
          },
        });
      } else {
        setGeneralError('Unexpected response. Please try again.');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) {
          setEmailError('No account found with this email');
        } else if (error.status === 403) {
          setGeneralError(error.message || 'No seller account associated with this email.');
        } else if (error.status === 429) {
          setGeneralError('Too many attempts. Please try again later.');
        } else if (error.status === 0) {
          setGeneralError('Cannot connect to server. Ensure backend is running on port 3001.');
        } else {
          setGeneralError(error.message || 'Failed to send OTP. Please try again.');
        }
      } else {
        setGeneralError('Network error. Please check your connection.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, validateEmail, isAgreed, router]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const canSubmit = !!email.trim() && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          style={styles.header}
          entering={FadeInDown.duration(600).delay(100)}
        >
          <Animated.View
            style={styles.logoWrapper}
            entering={FadeIn.duration(400).delay(200)}
          >
            <View style={styles.logoContainer}>
              <Box size={24} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(500).delay(300)}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to your RetailOps account
            </Text>
          </Animated.View>
        </Animated.View>

        {/* Login Card */}
        <Animated.View
          style={styles.card}
          entering={FadeInDown.duration(600).delay(400)}
        >
          <Text style={styles.cardTitle}>Registered Business Email</Text>

          {generalError && (
            <Animated.View
              style={styles.errorBanner}
              entering={FadeIn.duration(200)}
            >
              <AlertCircle size={16} color="#DC2626" />
              <Text style={styles.errorBannerText}>{generalError}</Text>
            </Animated.View>
          )}

          <AnimatedInput
            inputRef={emailRef}
            label="Email Address"
            value={email}
            onChangeText={handleEmailChange}
            onBlur={handleEmailBlur}
            placeholder="you@company.com"
            keyboardType="email-address"
            error={emailError}
            success={isEmailValid && !emailError}
            disabled={isLoading}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          {/* Progress Bar — animated indeterminate */}
          {isLoading && <IndeterminateProgressBar />}

          {/* Terms Checkbox */}
          <Pressable
            style={styles.checkboxContainer}
            onPress={() => setIsAgreed(!isAgreed)}
            disabled={isLoading}
          >
            <AnimatedCheckbox
              checked={isAgreed}
              onToggle={() => setIsAgreed(!isAgreed)}
              disabled={isLoading}
            />
            <Text style={styles.checkboxLabel}>
              I agree to the{' '}
              <Text style={styles.checkboxLink}>Terms of Service</Text> and{' '}
              <Text style={styles.checkboxLink}>Privacy Policy</Text>
            </Text>
          </Pressable>

          {/* Submit Button */}
          <AnimatedPressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            onPressIn={() => {
              buttonScale.value = withSpring(0.97, {
                damping: 15,
                stiffness: 300,
              });
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1, {
                damping: 15,
                stiffness: 300,
              });
            }}
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
              buttonAnimatedStyle,
            ]}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <SpinningLoader size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Sending OTP...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.submitButtonText}>Send OTP</Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </View>
            )}
          </AnimatedPressable>
        </Animated.View>

        {/* Security Badge */}
        <Animated.View
          style={styles.securitySection}
          entering={FadeIn.duration(600).delay(500)}
        >
          <View style={styles.securityBadge}>
            <ShieldCheck size={14} color="#64748B" />
            <Text style={styles.securityText}>Secure OTP authentication</Text>
          </View>
        </Animated.View>

        {/* Footer */}
        <Animated.View
          style={styles.footer}
          entering={FadeIn.duration(600).delay(600)}
        >
          <Text style={styles.footerText}>RetailOps Partner © 2024</Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },

  header: { alignItems: 'center', marginBottom: 32 },
  logoWrapper: { marginBottom: 24 },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: isSmallDevice ? 24 : 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.02,
    textAlign: 'center',
  },
  subtitle: { fontSize: 15, color: '#64748B', textAlign: 'center' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 20,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },

  // ── Progress bar ──
  progressBar: {
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    width: 100,
    backgroundColor: '#2563EB',
    borderRadius: 2,
  },

  // ── Checkbox ──
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 24,
  },
  checkboxTouchArea: {
    marginTop: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  checkboxLink: { color: '#2563EB', fontWeight: '600' },

  // ── Submit button ──
  submitButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.01,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // ── Security ──
  securitySection: { alignItems: 'center', marginBottom: 16 },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  securityText: { fontSize: 12, fontWeight: '500', color: '#64748B' },

  footer: { marginTop: 'auto', alignItems: 'center', paddingBottom: 8 },
  footerText: { fontSize: 12, color: '#94A3B8' },
});