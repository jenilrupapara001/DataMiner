/**
 * BrandCentral Partner — OTP Verification Screen
 *
 * Verify your email with 6-digit verification code.
 * Screen 2 of the authentication flow.
 *
 * Design: BrandCentral Partner
 * Reference: Seller Success Platform
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
  Dimensions,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
} from 'react-native-reanimated';
import {
  ChevronLeft,
  Pencil,
  ShieldCheck,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react-native';
import { authService, ApiError } from '@/services';

// ============================================================
// CONSTANTS
// ============================================================

const OTP_LENGTH = 6;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive sizing utilities
const scale = (size: number) => {
  const baseWidth = 375;
  const ratio = SCREEN_WIDTH / baseWidth;
  return Math.min(Math.round(size * ratio), size * 1.2);
};

const moderateScale = (size: number, factor = 0.5) => {
  return size + (scale(size) - size) * factor;
};

const isTablet = SCREEN_WIDTH >= 768;
const isSmallDevice = SCREEN_WIDTH < 360;

// ============================================================
// BLINKING CURSOR
// ============================================================

function BlinkingCursor() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      false
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.cursor, style]} />;
}

// ============================================================
// ANIMATED OTP BOX
// ============================================================

interface OtpBoxProps {
  value: string;
  isFocused: boolean;
  isFilled: boolean;
  isError: boolean;
  isSuccess: boolean;
  index: number;
  onPress: () => void;
  onChangeText: (text: string) => void;
  onKeyPress: (key: string) => void;
  onFocus: () => void;
  inputRef: (ref: TextInput | null) => void;
}

function OtpBox({
  value,
  isFocused,
  isFilled,
  isError,
  isSuccess,
  index,
  onPress,
  onChangeText,
  onKeyPress,
  onFocus,
  inputRef,
}: OtpBoxProps) {
  const scaleAnim = useSharedValue(1);

  useEffect(() => {
    if (isFilled) {
      scaleAnim.value = withSequence(
        withSpring(0.92, { damping: 12, stiffness: 400 }),
        withSpring(1, { damping: 14, stiffness: 260 })
      );
    }
  }, [isFilled, scaleAnim]);

  const animatedBoxStyle = useAnimatedStyle(() => {
    const borderColor = isError
      ? '#DC2626'
      : isSuccess
        ? '#16A34A'
        : isFocused
          ? '#2563EB'
          : '#D1D5DB';

    return {
      transform: [{ scale: scaleAnim.value }],
      borderColor,
      borderWidth: isFocused ? 2 : 1.5,
    };
  });

  return (
    <Pressable onPress={onPress} style={styles.otpPressable}>
      <Animated.View style={[styles.otpBox, animatedBoxStyle]}>
        <TextInput
          ref={inputRef}
          style={[
            styles.otpInput,
            isError && styles.otpInputError,
            isSuccess && styles.otpInputSuccess,
          ]}
          value={value}
          onChangeText={onChangeText}
          onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key)}
          onFocus={onFocus}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          caretHidden
          accessibilityLabel={`Digit ${index + 1} of ${OTP_LENGTH}`}
          autoFocus={Platform.OS === 'android' && index === 0}
        />
        {isFocused && !value && <BlinkingCursor />}
      </Animated.View>
    </Pressable>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function OtpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    tempToken?: string;
    destination?: string;
    expiresIn?: string;
  }>();

  // OTP state
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Timer state
  const [resendTimer, setResendTimer] = useState(parseInt(params.expiresIn || '600', 10));
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Refs
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // ============================================================
  // EFFECTS
  // ============================================================

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Auto-focus first input
  useEffect(() => {
    const delay = Platform.OS === 'ios' ? 500 : 300;
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleVerify = useCallback(
    async (otpCode?: string) => {
      const code = otpCode || otp.join('');
      const tempToken = params.tempToken;

      if (code.length !== OTP_LENGTH) {
        setError('Please enter the complete verification code');
        return;
      }

      if (!tempToken) {
        setError('Session expired. Please login again.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await authService.verifyOtp(tempToken, code, true);
        setIsSuccess(true);
        Keyboard.dismiss();

        setTimeout(() => {
          router.replace('/(tabs)');
        }, 1200);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 400) {
            setError('Invalid verification code. Please try again.');
          } else if (err.status === 410) {
            setError('Code expired. Please request a new one.');
            setCanResend(true);
          } else if (err.status === 429) {
            setError('Too many attempts. Please wait before trying again.');
          } else {
            setError(err.message || 'Verification failed. Please try again.');
          }
        } else {
          setError('Network error. Please check your connection.');
        }

        setOtp(Array(OTP_LENGTH).fill(''));
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 300);
      } finally {
        setIsLoading(false);
      }
    },
    [otp, params.tempToken, router]
  );

  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      const digit = text.replace(/[^0-9]/g, '').slice(-1);

      const newOtp = [...otp];
      newOtp[index] = digit;
      setOtp(newOtp);
      setError(null);

      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (newOtp.every((d) => d !== '') && newOtp.join('').length === OTP_LENGTH) {
        setTimeout(() => handleVerify(newOtp.join('')), 100);
      }
    },
    [otp, handleVerify]
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
      }
    },
    [otp]
  );

  const handleResend = useCallback(async () => {
    if (!canResend || !params.tempToken) return;

    setIsResending(true);

    try {
      const response = await authService.resendOtp(params.tempToken);
      setCanResend(false);
      setResendTimer(response.expiresIn || 600);
      setOtp(Array(OTP_LENGTH).fill(''));
      setError(null);
      setIsSuccess(false);

      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 300);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to resend code.');
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  }, [canResend, params.tempToken]);

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    router.back();
  }, [router]);

  const handleEditEmail = useCallback(() => {
    Keyboard.dismiss();
    router.back();
  }, [router]);

  const handleBoxPress = useCallback((index: number) => {
    inputRefs.current[index]?.focus();
  }, []);

  const handleBoxFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const handleSupportPress = useCallback(() => {
    Linking.openURL('mailto:support@brandcentral.com');
  }, []);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const email = params.destination || 'your email';
  const filledCount = otp.filter(Boolean).length;
  const canSubmit = filledCount === OTP_LENGTH && !isLoading;

  // Format timer as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Human-readable expiry (for security notice)
  const expiryMinutes = Math.max(1, Math.ceil(resendTimer / 60));

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0
        }
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + moderateScale(12),
              paddingBottom: insets.bottom + moderateScale(16),
            },
          ]}
        >
          {/* ── Back Button ── */}
          <Animated.View entering={FadeIn.duration(300)}>
            <Pressable
              style={styles.backButton}
              onPress={handleBack}
              accessibilityLabel="Go back"
              hitSlop={12}
            >
              <ChevronLeft
                size={moderateScale(26)}
                color="#0F172A"
                strokeWidth={2.2}
              />
            </Pressable>
          </Animated.View>

          {/* ── Main Content ── */}
          <View style={styles.mainContent}>
            {/* Title */}
            <Animated.Text
              entering={FadeInDown.duration(500).delay(100)}
              style={[
                styles.title,
                isSmallDevice && styles.titleSmall,
                isTablet && styles.titleTablet,
              ]}
            >
              {isSuccess ? "You're Verified!" : 'Verify Your Email'}
            </Animated.Text>

            {/* Description */}
            {!isSuccess ? (
              <>
                <Animated.Text
                  entering={FadeInDown.duration(500).delay(150)}
                  style={[
                    styles.description,
                    isSmallDevice && styles.descriptionSmall,
                    isTablet && styles.descriptionTablet,
                  ]}
                >
                  We have sent a 6-digit verification code to
                </Animated.Text>

                {/* Email Pill */}
                <Animated.View
                  entering={FadeInDown.duration(500).delay(200)}
                  style={styles.emailWrapper}
                >
                  <Pressable
                    style={styles.emailPill}
                    onPress={handleEditEmail}
                    accessibilityLabel={`Edit email address ${email}`}
                  >
                    <Text
                      style={[
                        styles.emailText,
                        isSmallDevice && styles.emailTextSmall,
                      ]}
                      numberOfLines={1}
                    >
                      {email}
                    </Text>
                    <Pencil
                      size={moderateScale(14)}
                      color="#0F172A"
                      strokeWidth={2}
                    />
                  </Pressable>
                </Animated.View>
              </>
            ) : (
              <Animated.Text
                entering={FadeInDown.duration(500).delay(150)}
                style={[
                  styles.description,
                  isSmallDevice && styles.descriptionSmall,
                  isTablet && styles.descriptionTablet,
                ]}
              >
                Redirecting you to the dashboard...
              </Animated.Text>
            )}

            {/* OTP Boxes */}
            {!isSuccess && (
              <Animated.View
                entering={FadeInDown.duration(500).delay(250)}
                style={styles.otpRow}
              >
                {Array(OTP_LENGTH)
                  .fill(null)
                  .map((_, index) => (
                    <OtpBox
                      key={index}
                      index={index}
                      value={otp[index]}
                      isFocused={focusedIndex === index}
                      isFilled={!!otp[index]}
                      isError={!!error}
                      isSuccess={isSuccess}
                      onPress={() => handleBoxPress(index)}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={(key) => handleKeyPress(key, index)}
                      onFocus={() => handleBoxFocus(index)}
                      inputRef={(ref) => {
                        inputRefs.current[index] = ref;
                      }}
                    />
                  ))}
              </Animated.View>
            )}

            {/* Resend Row */}
            {!isSuccess && (
              <Animated.View
                entering={FadeInDown.duration(500).delay(300)}
                style={styles.resendRow}
              >
                <Text
                  style={[
                    styles.resendLabel,
                    isSmallDevice && styles.resendLabelSmall,
                  ]}
                >
                  {"Didn't receive the code?"}
                </Text>
                {canResend ? (
                  <Pressable
                    onPress={handleResend}
                    disabled={isResending}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.resendLink,
                        isSmallDevice && styles.resendLinkSmall,
                      ]}
                    >
                      {isResending ? 'Sending...' : 'Resend Now'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    style={[
                      styles.resendTimer,
                      isSmallDevice && styles.resendTimerSmall,
                    ]}
                  >
                    Resend in{' '}
                    <Text style={styles.resendTimerValue}>
                      {formatTime(resendTimer)}
                    </Text>
                  </Text>
                )}
              </Animated.View>
            )}

            {/* Error Message */}
            {error && !isSuccess && (
              <Animated.Text
                entering={FadeIn.duration(200)}
                style={[
                  styles.errorText,
                  isSmallDevice && styles.errorTextSmall,
                ]}
              >
                {error}
              </Animated.Text>
            )}

            {/* Security Notice */}
            {!isSuccess && (
              <Animated.View
                entering={FadeInDown.duration(500).delay(350)}
                style={styles.securityCard}
              >
                <ShieldCheck
                  size={moderateScale(20)}
                  color="#2563EB"
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.securityText,
                    isSmallDevice && styles.securityTextSmall,
                  ]}
                >
                  For your security, this verification code expires in{' '}
                  <Text style={styles.securityTextBold}>
                    {expiryMinutes} minute{expiryMinutes !== 1 ? 's' : ''}
                  </Text>
                  .
                </Text>
              </Animated.View>
            )}
          </View>

          {/* ── Footer Actions ── */}
          <Animated.View
            entering={FadeIn.duration(500).delay(450)}
            style={[styles.footer, isTablet && styles.footerTablet]}
          >
            {/* Verify Button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
                isSuccess && styles.submitButtonSuccess,
                pressed && canSubmit && styles.submitButtonPressed,
                isTablet && styles.submitButtonTablet,
              ]}
              onPress={() => handleVerify()}
              disabled={!canSubmit || isSuccess}
            >
              {isSuccess ? (
                <View style={styles.submitButtonInner}>
                  <CheckCircle2
                    size={moderateScale(20)}
                    color="#FFFFFF"
                    strokeWidth={2.5}
                  />
                  <Text
                    style={[
                      styles.submitButtonText,
                      isSmallDevice && styles.submitButtonTextSmall,
                    ]}
                  >
                    Verified
                  </Text>
                </View>
              ) : isLoading ? (
                <View style={styles.submitButtonInner}>
                  <Loader2
                    size={moderateScale(20)}
                    color="#FFFFFF"
                    strokeWidth={2.5}
                  />
                  <Text
                    style={[
                      styles.submitButtonText,
                      isSmallDevice && styles.submitButtonTextSmall,
                    ]}
                  >
                    Verifying...
                  </Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.submitButtonText,
                    isSmallDevice && styles.submitButtonTextSmall,
                  ]}
                >
                  Verify & Continue
                </Text>
              )}
            </Pressable>

            {/* Support Link */}
            <Pressable
              style={styles.supportRow}
              onPress={handleSupportPress}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.supportText,
                  isSmallDevice && styles.supportTextSmall,
                ]}
              >
                Need Help? Contact BrandCentral Support
              </Text>
              <ArrowUpRight
                size={moderateScale(16)}
                color="#0F172A"
                strokeWidth={2}
              />
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F2F7',
  },
  content: {
    flex: 1,
    paddingHorizontal: moderateScale(24),
  },

  // ── Back button ──
  backButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: moderateScale(24),
  },

  // ── Main Content ──
  mainContent: {
    flex: 1,
  },

  // ── Title ──
  title: {
    fontSize: moderateScale(32),
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.8,
    marginBottom: moderateScale(12),
  },
  titleSmall: {
    fontSize: moderateScale(26),
  },
  titleTablet: {
    fontSize: moderateScale(40),
  },

  // ── Description ──
  description: {
    fontSize: moderateScale(15),
    color: '#475569',
    lineHeight: moderateScale(22),
    marginBottom: moderateScale(16),
  },
  descriptionSmall: {
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
  },
  descriptionTablet: {
    fontSize: moderateScale(18),
    lineHeight: moderateScale(26),
  },

  // ── Email Pill ──
  emailWrapper: {
    alignItems: 'flex-start',
    marginBottom: moderateScale(28),
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
    backgroundColor: '#E8ECFB',
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(10),
    borderWidth: 1,
    borderColor: '#D6DBF0',
    maxWidth: '100%',
  },
  emailText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#2563EB',
    flexShrink: 1,
  },
  emailTextSmall: {
    fontSize: moderateScale(13),
  },

  // ── OTP Row ──
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: moderateScale(8),
    marginBottom: moderateScale(24),
  },
  otpPressable: {
    flex: 1,
  },
  otpBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpInput: {
    width: '100%',
    height: '100%',
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    ...(Platform.OS === 'android' && {
      padding: 0,
      margin: 0,
    }),
  },
  otpInputError: {
    color: '#DC2626',
  },
  otpInputSuccess: {
    color: '#16A34A',
  },
  cursor: {
    position: 'absolute',
    width: moderateScale(2),
    height: moderateScale(26),
    borderRadius: 1,
    backgroundColor: '#0F172A',
  },

  // ── Resend Row ──
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
    marginBottom: moderateScale(16),
    flexWrap: 'wrap',
  },
  resendLabel: {
    fontSize: moderateScale(14),
    color: '#0F172A',
    fontWeight: '500',
  },
  resendLabelSmall: {
    fontSize: moderateScale(12),
  },
  resendLink: {
    fontSize: moderateScale(14),
    color: '#2563EB',
    fontWeight: '600',
  },
  resendLinkSmall: {
    fontSize: moderateScale(12),
  },
  resendTimer: {
    fontSize: moderateScale(14),
    color: '#2563EB',
    fontWeight: '500',
  },
  resendTimerSmall: {
    fontSize: moderateScale(12),
  },
  resendTimerValue: {
    fontSize: moderateScale(14),
    color: '#2563EB',
    fontWeight: '700',
  },

  // ── Error ──
  errorText: {
    fontSize: moderateScale(13),
    color: '#DC2626',
    fontWeight: '500',
    marginBottom: moderateScale(12),
  },
  errorTextSmall: {
    fontSize: moderateScale(12),
  },

  // ── Security Card ──
  securityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: moderateScale(12),
    backgroundColor: '#E8ECFB',
    borderRadius: moderateScale(14),
    padding: moderateScale(16),
  },
  securityText: {
    flex: 1,
    fontSize: moderateScale(14),
    color: '#0F172A',
    lineHeight: moderateScale(20),
    fontWeight: '400',
  },
  securityTextSmall: {
    fontSize: moderateScale(12),
    lineHeight: moderateScale(18),
  },
  securityTextBold: {
    fontWeight: '700',
    color: '#0F172A',
  },

  // ── Footer ──
  footer: {
    paddingTop: moderateScale(16),
  },
  footerTablet: {
    paddingHorizontal: moderateScale(40),
  },

  // ── Submit Button ──
  submitButton: {
    height: moderateScale(56),
    borderRadius: moderateScale(16),
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: moderateScale(20),
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonTablet: {
    height: moderateScale(64),
    borderRadius: moderateScale(18),
  },
  submitButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonSuccess: {
    backgroundColor: '#16A34A',
    shadowColor: '#16A34A',
  },
  submitButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(8),
  },
  submitButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  submitButtonTextSmall: {
    fontSize: moderateScale(14),
  },

  // ── Support ──
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(6),
  },
  supportText: {
    fontSize: moderateScale(14),
    color: '#0F172A',
    fontWeight: '500',
  },
  supportTextSmall: {
    fontSize: moderateScale(12),
  },
});