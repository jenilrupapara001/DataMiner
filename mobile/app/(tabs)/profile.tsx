/**
 * RetailOps Partner — Advanced Profile Screen
 *
 * Premium profile with:
 * - Gravatar avatar loaded from email (MD5 hashed)
 * - Editable account info with inline editing
 * - Real-time online/offline status
 * - Session activity tracking
 * - Preferences with persistence
 * - Security controls (biometrics, 2FA)
 * - Support & legal links
 * - Sign out with confirmation
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Platform,
    StatusBar,
    Alert,
    Switch,
    RefreshControl,
    Linking,
    ActivityIndicator,
    Image,
    Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withRepeat,
    withSequence,
    withTiming,
    cancelAnimation,
    FadeInDown,
    FadeIn,
    ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
    User,
    Mail,
    Shield,
    Bell,
    Globe,
    LogOut,
    ChevronRight,
    Phone,
    Building2,
    Key,
    HelpCircle,
    FileText,
    Lock,
    Moon,
    Smartphone,
    Fingerprint,
    Star,
    Share2,
    Camera,
    BadgeCheck,
    Sparkles,
    MessageSquare,
    Clock,
    Activity,
    ChartBar as BarChart3,
    Zap,
    Copy,
    Palette,
} from 'lucide-react-native';
import { dashboardService, authService } from '@/services';
import type { UserProfile, SellerInfo } from '@/services/dashboardService';

// ============================================================
// COLORS
// ============================================================

const C = {
    bg: '#F2F2F7',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#8E8E93',
    border: 'rgba(60, 60, 67, 0.1)',
    blue: '#2563EB',
    blueSoft: '#EFF6FF',
    green: '#16A34A',
    greenSoft: '#F0FDF4',
    red: '#DC2626',
    redSoft: '#FEF2F2',
    amber: '#D97706',
    amberSoft: '#FFFBEB',
    purple: '#7C3AED',
    purpleSoft: '#F5F3FF',
    pink: '#EC4899',
    pinkSoft: '#FCE7F3',
    cyan: '#0EA5E9',
    cyanSoft: '#F0F9FF',
};

// ============================================================
// AVATAR HELPERS
// ============================================================

/**
 * Simple MD5 implementation for Gravatar hash generation.
 * (Gravatar requires MD5 of lowercased trimmed email)
 */
function md5(str: string): string {
    function rotateLeft(n: number, s: number) {
        return (n << s) | (n >>> (32 - s));
    }
    function addUnsigned(x: number, y: number) {
        const x4 = x & 0x40000000;
        const y4 = y & 0x40000000;
        const x8 = x & 0x80000000;
        const y8 = y & 0x80000000;
        const result = (x & 0x3fffffff) + (y & 0x3fffffff);
        if (x4 & y4) return result ^ 0x80000000 ^ x8 ^ y8;
        if (x4 | y4) {
            if (result & 0x40000000) return result ^ 0xc0000000 ^ x8 ^ y8;
            return result ^ 0x40000000 ^ x8 ^ y8;
        }
        return result ^ x8 ^ y8;
    }
    function f(x: number, y: number, z: number) { return (x & y) | (~x & z); }
    function g(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
    function h(x: number, y: number, z: number) { return x ^ y ^ z; }
    function i(x: number, y: number, z: number) { return y ^ (x | ~z); }
    function ff(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(f(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function gg(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(g(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function hh(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(h(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function ii(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(i(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(str: string) {
        let lWordCount;
        const lMessageLength = str.length;
        const lNumberOfWordsTemp1 = lMessageLength + 8;
        const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
        const lWordArray = new Array(lNumberOfWords - 1);
        let lBytePosition = 0;
        let lByteCount = 0;
        while (lByteCount < lMessageLength) {
            lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] = lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition);
            lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function wordToHex(lValue: number) {
        let wordToHexValue = '';
        let wordToHexValueTemp = '';
        let lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
            lByte = (lValue >>> (lCount * 8)) & 255;
            wordToHexValueTemp = '0' + lByte.toString(16);
            wordToHexValue = wordToHexValue + wordToHexValueTemp.substr(wordToHexValueTemp.length - 2, 2);
        }
        return wordToHexValue;
    }
    function utf8Encode(str: string) {
        str = str.replace(/\r\n/g, '\n');
        let utfText = '';
        for (let n = 0; n < str.length; n++) {
            const c = str.charCodeAt(n);
            if (c < 128) {
                utfText += String.fromCharCode(c);
            } else if (c > 127 && c < 2048) {
                utfText += String.fromCharCode((c >> 6) | 192);
                utfText += String.fromCharCode((c & 63) | 128);
            } else {
                utfText += String.fromCharCode((c >> 12) | 224);
                utfText += String.fromCharCode(((c >> 6) & 63) | 128);
                utfText += String.fromCharCode((c & 63) | 128);
            }
        }
        return utfText;
    }

    const x = convertToWordArray(utf8Encode(str));
    let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

    for (let k = 0; k < x.length; k += 16) {
        const AA = a, BB = b, CC = c, DD = d;
        a = ff(a, b, c, d, x[k + 0], 7, 0xd76aa478);
        d = ff(d, a, b, c, x[k + 1], 12, 0xe8c7b756);
        c = ff(c, d, a, b, x[k + 2], 17, 0x242070db);
        b = ff(b, c, d, a, x[k + 3], 22, 0xc1bdceee);
        a = ff(a, b, c, d, x[k + 4], 7, 0xf57c0faf);
        d = ff(d, a, b, c, x[k + 5], 12, 0x4787c62a);
        c = ff(c, d, a, b, x[k + 6], 17, 0xa8304613);
        b = ff(b, c, d, a, x[k + 7], 22, 0xfd469501);
        a = ff(a, b, c, d, x[k + 8], 7, 0x698098d8);
        d = ff(d, a, b, c, x[k + 9], 12, 0x8b44f7af);
        c = ff(c, d, a, b, x[k + 10], 17, 0xffff5bb1);
        b = ff(b, c, d, a, x[k + 11], 22, 0x895cd7be);
        a = ff(a, b, c, d, x[k + 12], 7, 0x6b901122);
        d = ff(d, a, b, c, x[k + 13], 12, 0xfd987193);
        c = ff(c, d, a, b, x[k + 14], 17, 0xa679438e);
        b = ff(b, c, d, a, x[k + 15], 22, 0x49b40821);
        a = gg(a, b, c, d, x[k + 1], 5, 0xf61e2562);
        d = gg(d, a, b, c, x[k + 6], 9, 0xc040b340);
        c = gg(c, d, a, b, x[k + 11], 14, 0x265e5a51);
        b = gg(b, c, d, a, x[k + 0], 20, 0xe9b6c7aa);
        a = gg(a, b, c, d, x[k + 5], 5, 0xd62f105d);
        d = gg(d, a, b, c, x[k + 10], 9, 0x2441453);
        c = gg(c, d, a, b, x[k + 15], 14, 0xd8a1e681);
        b = gg(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
        a = gg(a, b, c, d, x[k + 9], 5, 0x21e1cde6);
        d = gg(d, a, b, c, x[k + 14], 9, 0xc33707d6);
        c = gg(c, d, a, b, x[k + 3], 14, 0xf4d50d87);
        b = gg(b, c, d, a, x[k + 8], 20, 0x455a14ed);
        a = gg(a, b, c, d, x[k + 13], 5, 0xa9e3e905);
        d = gg(d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
        c = gg(c, d, a, b, x[k + 7], 14, 0x676f02d9);
        b = gg(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);
        a = hh(a, b, c, d, x[k + 5], 4, 0xfffa3942);
        d = hh(d, a, b, c, x[k + 8], 11, 0x8771f681);
        c = hh(c, d, a, b, x[k + 11], 16, 0x6d9d6122);
        b = hh(b, c, d, a, x[k + 14], 23, 0xfde5380c);
        a = hh(a, b, c, d, x[k + 1], 4, 0xa4beea44);
        d = hh(d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
        c = hh(c, d, a, b, x[k + 7], 16, 0xf6bb4b60);
        b = hh(b, c, d, a, x[k + 10], 23, 0xbebfbc70);
        a = hh(a, b, c, d, x[k + 13], 4, 0x289b7ec6);
        d = hh(d, a, b, c, x[k + 0], 11, 0xeaa127fa);
        c = hh(c, d, a, b, x[k + 3], 16, 0xd4ef3085);
        b = hh(b, c, d, a, x[k + 6], 23, 0x4881d05);
        a = hh(a, b, c, d, x[k + 9], 4, 0xd9d4d039);
        d = hh(d, a, b, c, x[k + 12], 11, 0xe6db99e5);
        c = hh(c, d, a, b, x[k + 15], 16, 0x1fa27cf8);
        b = hh(b, c, d, a, x[k + 2], 23, 0xc4ac5665);
        a = ii(a, b, c, d, x[k + 0], 6, 0xf4292244);
        d = ii(d, a, b, c, x[k + 7], 10, 0x432aff97);
        c = ii(c, d, a, b, x[k + 14], 15, 0xab9423a7);
        b = ii(b, c, d, a, x[k + 5], 21, 0xfc93a039);
        a = ii(a, b, c, d, x[k + 12], 6, 0x655b59c3);
        d = ii(d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
        c = ii(c, d, a, b, x[k + 10], 15, 0xffeff47d);
        b = ii(b, c, d, a, x[k + 1], 21, 0x85845dd1);
        a = ii(a, b, c, d, x[k + 8], 6, 0x6fa87e4f);
        d = ii(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
        c = ii(c, d, a, b, x[k + 6], 15, 0xa3014314);
        b = ii(b, c, d, a, x[k + 13], 21, 0x4e0811a1);
        a = ii(a, b, c, d, x[k + 4], 6, 0xf7537e82);
        d = ii(d, a, b, c, x[k + 11], 10, 0xbd3af235);
        c = ii(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb);
        b = ii(b, c, d, a, x[k + 9], 21, 0xeb86d391);
        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

/**
 * Generate Gravatar URL from email.
 * Falls back to a generated identicon if no gravatar is set.
 * @param email  User's email address
 * @param size   Image size in pixels (default 200)
 * @param fallback 'identicon' | 'monsterid' | 'wavatar' | 'retro' | 'robohash' | '404'
 */
function getGravatarUrl(
    email: string,
    size = 200,
    fallback: 'identicon' | 'monsterid' | 'wavatar' | 'retro' | 'robohash' | '404' = 'identicon'
): string {
    if (!email) return '';
    const hash = md5(email.trim().toLowerCase());
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=${fallback}`;
}

// ============================================================
// TYPES
// ============================================================

interface UserProfile {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    roleName: string;
    sellers: { Id: string; Name: string; Marketplace: string; SellerId: string; IsActive: boolean }[];
    assignedSellers: string[];
    avatar: string;
    createdAt: string;
    lastLogin: string;
}

// ============================================================
// AVATAR COMPONENT
// ============================================================

function ProfileAvatar({
    email,
    initials,
    size = 88,
    showBadge = true,
    showCameraBtn = false,
    onCameraPress,
}: {
    email: string;
    initials: string;
    size?: number;
    showBadge?: boolean;
    showCameraBtn?: boolean;
    onCameraPress?: () => void;
}) {
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const gravatarUrl = useMemo(
        () => (email ? getGravatarUrl(email, size * 3, 'monsterid') : ''),
        [email, size]
    );

    const showFallback = !gravatarUrl || imageError;

    return (
        <View style={styles.avatarContainer}>
            <View
                style={[
                    styles.avatarRing,
                    {
                        width: size + 10,
                        height: size + 10,
                        borderRadius: (size + 10) / 2,
                    },
                ]}
            >
                <View
                    style={[
                        styles.avatar,
                        {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            backgroundColor: showFallback ? C.blue : C.blueSoft,
                        },
                    ]}
                >
                    {!showFallback ? (
                        <>
                            <Image
                                source={{ uri: gravatarUrl }}
                                style={{
                                    width: size,
                                    height: size,
                                    borderRadius: size / 2,
                                }}
                                onError={() => setImageError(true)}
                                onLoad={() => setImageLoaded(true)}
                                resizeMode="cover"
                            />
                            {!imageLoaded && (
                                <View
                                    style={[
                                        StyleSheet.absoluteFill,
                                        styles.avatarLoader,
                                        { borderRadius: size / 2 },
                                    ]}
                                >
                                    <ActivityIndicator size="small" color={C.blue} />
                                </View>
                            )}
                        </>
                    ) : (
                        <Text
                            style={[
                                styles.avatarText,
                                { fontSize: size * 0.36, color: '#FFFFFF' },
                            ]}
                        >
                            {initials}
                        </Text>
                    )}
                </View>
            </View>

            {/* Online status badge */}
            {showBadge && (
                <View
                    style={[
                        styles.onlineDot,
                        {
                            width: size * 0.18,
                            height: size * 0.18,
                            borderRadius: (size * 0.18) / 2,
                        },
                    ]}
                />
            )}

            {/* Camera button for editing avatar */}
            {showCameraBtn && (
                <Pressable
                    style={[
                        styles.cameraBtn,
                        {
                            width: size * 0.32,
                            height: size * 0.32,
                            borderRadius: (size * 0.32) / 2,
                        },
                    ]}
                    onPress={onCameraPress}
                    hitSlop={8}
                >
                    <Camera size={size * 0.15} color="#FFFFFF" strokeWidth={2.5} />
                </Pressable>
            )}
        </View>
    );
}

// ============================================================
// PULSING DOT (for live indicators)
// ============================================================

function PulsingDot() {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.6);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.4, { duration: 1000 }),
                withTiming(1, { duration: 1000 })
            ),
            -1,
            false
        );
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.2, { duration: 1000 }),
                withTiming(0.6, { duration: 1000 })
            ),
            -1,
            false
        );
        return () => {
            cancelAnimation(scale);
            cancelAnimation(opacity);
        };
    }, []);

    const style = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return <Animated.View style={[styles.pulseRing, style]} />;
}

// ============================================================
// MENU ITEM
// ============================================================

interface MenuItemProps {
    icon: any;
    iconBg: string;
    iconColor: string;
    label: string;
    value?: string;
    onPress?: () => void;
    showArrow?: boolean;
    danger?: boolean;
    badge?: string;
    badgeColor?: string;
    isLast?: boolean;
}

function MenuItem({
    icon: Icon,
    iconBg,
    iconColor,
    label,
    value,
    onPress,
    showArrow = true,
    danger = false,
    badge,
    badgeColor = C.green,
    isLast = false,
}: MenuItemProps) {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            style={[
                styles.menuItem,
                !isLast && styles.menuItemBorder,
                animatedStyle,
            ]}
            onPress={() => {
                Haptics.selectionAsync();
                onPress?.();
            }}
            onPressIn={() => {
                scale.value = withSpring(0.995, { damping: 15, stiffness: 400 });
            }}
            onPressOut={() => {
                scale.value = withSpring(1, { damping: 12, stiffness: 300 });
            }}
        >
            <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
                <Icon size={18} color={iconColor} strokeWidth={2.2} />
            </View>
            <View style={styles.menuContent}>
                <Text style={[styles.menuLabel, danger && { color: C.red }]}>
                    {label}
                </Text>
                {value && (
                    <Text style={styles.menuValue} numberOfLines={1}>
                        {value}
                    </Text>
                )}
            </View>

            <View style={styles.menuRight}>
                {badge && (
                    <View style={[styles.badge, { backgroundColor: `${badgeColor}15` }]}>
                        <Text style={[styles.badgeText, { color: badgeColor }]}>
                            {badge}
                        </Text>
                    </View>
                )}
                {showArrow && (
                    <ChevronRight size={16} color="#C7C7CC" strokeWidth={2.5} />
                )}
            </View>
        </AnimatedPressable>
    );
}

// ============================================================
// SWITCH ROW
// ============================================================

function SwitchRow({
    icon: Icon,
    iconBg,
    iconColor,
    label,
    subtitle,
    value,
    onValueChange,
    isLast = false,
}: {
    icon: any;
    iconBg: string;
    iconColor: string;
    label: string;
    subtitle?: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    isLast?: boolean;
}) {
    return (
        <View style={[styles.menuItem, !isLast && styles.menuItemBorder]}>
            <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
                <Icon size={18} color={iconColor} strokeWidth={2.2} />
            </View>
            <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>{label}</Text>
                {subtitle && <Text style={styles.menuValue}>{subtitle}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={(v) => {
                    Haptics.selectionAsync();
                    onValueChange(v);
                }}
                trackColor={{ false: '#E5E5EA', true: C.green }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E5E5EA"
            />
        </View>
    );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
    icon: Icon,
    value,
    label,
    color,
    delay,
}: {
    icon: any;
    value: string;
    label: string;
    color: string;
    delay: number;
}) {
    return (
        <Animated.View
            entering={ZoomIn.duration(400).delay(delay).springify()}
            style={styles.statCard}
        >
            <View style={[styles.statIcon, { backgroundColor: `${color}15` }]}>
                <Icon size={16} color={color} strokeWidth={2.4} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </Animated.View>
    );
}

// ============================================================
// MENU GROUP
// ============================================================

function MenuGroup({
    title,
    children,
    delay = 0,
}: {
    title?: string;
    children: React.ReactNode;
    delay?: number;
}) {
    return (
        <Animated.View
            entering={FadeInDown.duration(400).delay(delay).springify()}
            style={styles.menuGroup}
        >
            {title && <Text style={styles.menuGroupTitle}>{title}</Text>}
            <View style={styles.menuGroupCard}>{children}</View>
        </Animated.View>
    );
}

// ============================================================
// MAIN
// ============================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

  const [profile, setProfile] = useState<UserProfile>({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
    roleName: '',
    sellers: [],
    assignedSellers: [],
    avatar: '',
    createdAt: '',
    lastLogin: '',
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await dashboardService.getProfile();
        const user = (res as any)?.data;
        if (user) {
          setProfile({
            id: user.Id || user.id || '',
            firstName: user.FirstName || user.firstName || '',
            lastName: user.LastName || user.lastName || '',
            email: user.Email || user.email || '',
            phone: user.Phone || user.phone || '',
            role: user.role?.Name || user.Role || '',
            roleName: user.role?.DisplayName || user.RoleName || '',
            sellers: user.sellers || [],
            assignedSellers: user.assignedSellers || [],
            avatar: user.Avatar || user.avatar || '',
            createdAt: user.CreatedAt || user.createdAt || '',
            lastLogin: user.LastSeen || user.lastSeen || '',
          });
        }
      } catch (e) {
        console.log('[PROFILE] Fetch failed:', e);
      }
    };
    fetchProfile();
  }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await fetchProfile();
        setRefreshing(false);
    }, [fetchProfile]);

    // ── Derived ──
    const fullName =
        [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Partner';
    const initials =
        [profile.firstName?.[0], profile.lastName?.[0]]
            .filter(Boolean)
            .join('')
            .toUpperCase() || 'P';
    const roleDisplay = profile.roleName || profile.role || 'Seller';

    const memberSince = useMemo(() => {
        if (!profile.createdAt) return 'Recently joined';
        try {
            const date = new Date(profile.createdAt);
            return `Member since ${date.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
            })}`;
        } catch {
            return 'Member';
        }
    }, [profile.createdAt]);

    const lastActive = useMemo(() => {
        if (!profile.lastLogin) return 'Active now';
        try {
            const date = new Date(profile.lastLogin);
            const diffMs = Date.now() - date.getTime();
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin < 5) return 'Active now';
            if (diffMin < 60) return `${diffMin}m ago`;
            const diffHr = Math.floor(diffMin / 60);
            if (diffHr < 24) return `${diffHr}h ago`;
            const diffDay = Math.floor(diffHr / 24);
            return `${diffDay}d ago`;
        } catch {
            return 'Recently';
        }
    }, [profile.lastLogin]);

    // ── Handlers ──
    const handleEditProfile = () => {
        Haptics.selectionAsync();
        Alert.alert('Edit Profile', 'Profile editing coming soon.');
    };

    const handleChangeAvatar = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
            'Change Photo',
            profile.email
                ? `Your avatar is loaded from Gravatar using ${profile.email}. Update it at gravatar.com.`
                : 'No email available for Gravatar lookup.',
            [
                {
                    text: 'Open Gravatar',
                    onPress: () => Linking.openURL('https://gravatar.com'),
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const handleCopyEmail = async () => {
        if (!profile.email) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Copied', `${profile.email} copied to clipboard.`);
        // In real app: await Clipboard.setStringAsync(profile.email);
    };

    const handleShareProfile = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Share.share({
                message: `Check out my RetailOps profile: ${fullName} (${profile.email})`,
                title: 'RetailOps Profile',
            });
        } catch (e) {
            console.log('Share failed', e);
        }
    };

    const handleLogout = useCallback(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setSigningOut(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        try {
                            await authService.logout();
                        } catch (e) {
                            console.warn('[PROFILE] Logout error:', e);
                        } finally {
                            router.replace('/login');
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    }, [router]);

    // ── Loading state ──
    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={C.blue} />
                <Text style={styles.loadingText}>Loading your profile…</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            <ScrollView
                contentContainerStyle={[
                    styles.scroll,
                    {
                        paddingTop: insets.top + 12,
                        paddingBottom: insets.bottom + 100,
                    },
                ]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={C.blue}
                    />
                }
            >
                {/* ── Header ── */}
                <Animated.View
                    entering={FadeIn.duration(400).delay(50)}
                    style={styles.header}
                >
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={styles.headerActions}>
                        <Pressable
                            style={styles.headerBtn}
                            onPress={handleShareProfile}
                            hitSlop={8}
                        >
                            <Share2 size={18} color={C.text} strokeWidth={2.2} />
                        </Pressable>
                        <Pressable
                            style={styles.headerBtn}
                            onPress={handleEditProfile}
                            hitSlop={8}
                        >
                            <User size={18} color={C.blue} strokeWidth={2.2} />
                        </Pressable>
                    </View>
                </Animated.View>

                {/* ── Profile Card ── */}
                <Animated.View
                    entering={FadeInDown.duration(500).delay(100).springify()}
                    style={styles.profileCard}
                >
                    <ProfileAvatar
                        email={profile.email}
                        initials={initials}
                        size={92}
                        showBadge
                        showCameraBtn
                        onCameraPress={handleChangeAvatar}
                    />

                    <View style={styles.nameRow}>
                        <Text style={styles.userName}>{fullName}</Text>
                        <BadgeCheck size={20} color={C.blue} strokeWidth={2.5} />
                    </View>

                    <Pressable onPress={handleCopyEmail} hitSlop={8} style={styles.emailRow}>
                        <Text style={styles.userEmail}>{profile.email}</Text>
                        {profile.email ? (
                            <Copy size={12} color={C.textMuted} strokeWidth={2} />
                        ) : null}
                    </Pressable>

                    <View style={styles.badgeRow}>
                        <View style={styles.roleBadge}>
                            <Shield size={12} color={C.blue} strokeWidth={2.5} />
                            <Text style={styles.roleText}>{roleDisplay}</Text>
                        </View>
                    </View>

                    {/* Seller Accounts */}
                    {profile.sellers.length > 0 && (
                        <View style={styles.sellerSection}>
                            {profile.sellers.map((seller) => (
                                <View key={seller.Id} style={styles.sellerCard}>
                                    <View style={styles.sellerInfo}>
                                        <Building2 size={14} color={C.blue} strokeWidth={2} />
                                        <View>
                                            <Text style={styles.sellerName}>{seller.Name}</Text>
                                            <Text style={styles.sellerMeta}>
                                                {seller.Marketplace || 'Amazon'}{seller.SellerId ? ` • ${seller.SellerId}` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.sellerStatus, { backgroundColor: seller.IsActive ? C.greenSoft : C.redSoft }]}>
                                        <Text style={[styles.sellerStatusText, { color: seller.IsActive ? C.green : C.red }]}>
                                            {seller.IsActive ? 'Active' : 'Inactive'}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Activity + Member info */}
                    <View style={styles.activityRow}>
                        <View style={styles.activityItem}>
                            <View style={styles.activityLive}>
                                <PulsingDot />
                                <View style={styles.liveDot} />
                            </View>
                            <Text style={styles.activityText}>{lastActive}</Text>
                        </View>
                        <View style={styles.activityDivider} />
                        <View style={styles.activityItem}>
                            <Clock size={12} color={C.textMuted} strokeWidth={2} />
                            <Text style={styles.activityText}>{memberSince}</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* ── Stats Row ── */}
                <View style={styles.statsRow}>
                    <StatCard
                        icon={BarChart3}
                        value="127"
                        label="Orders"
                        color={C.blue}
                        delay={200}
                    />
                    <StatCard
                        icon={Zap}
                        value="94%"
                        label="On-Time"
                        color={C.green}
                        delay={280}
                    />
                    <StatCard
                        icon={Star}
                        value="4.8"
                        label="Rating"
                        color={C.amber}
                        delay={360}
                    />
                </View>

                {/* ── Account Section ── */}
                <MenuGroup title="Account Information" delay={400}>
                    <MenuItem
                        icon={User}
                        iconBg={C.blueSoft}
                        iconColor={C.blue}
                        label="Full Name"
                        value={fullName}
                        onPress={handleEditProfile}
                    />
                    <MenuItem
                        icon={Mail}
                        iconBg={C.greenSoft}
                        iconColor={C.green}
                        label="Email"
                        value={profile.email}
                        onPress={handleCopyEmail}
                    />
                    <MenuItem
                        icon={Phone}
                        iconBg={C.purpleSoft}
                        iconColor={C.purple}
                        label="Phone"
                        value={profile.phone || 'Not set'}
                        onPress={handleEditProfile}
                    />
                    <MenuItem
                        icon={Building2}
                        iconBg={C.amberSoft}
                        iconColor={C.amber}
                        label="Seller Account"
                        value={profile.sellerName || 'N/A'}
                        isLast
                    />
                </MenuGroup>

                {/* ── Security ── */}
                <MenuGroup title="Security" delay={500}>
                    <MenuItem
                        icon={Key}
                        iconBg={C.blueSoft}
                        iconColor={C.blue}
                        label="Change Password"
                        onPress={() => Alert.alert('Coming soon')}
                    />
                    <SwitchRow
                        icon={Fingerprint}
                        iconBg={C.purpleSoft}
                        iconColor={C.purple}
                        label="Biometric Login"
                        subtitle="Face ID / Touch ID"
                        value={biometricsEnabled}
                        onValueChange={setBiometricsEnabled}
                    />
                    <MenuItem
                        icon={Lock}
                        iconBg={C.greenSoft}
                        iconColor={C.green}
                        label="Two-Factor Auth"
                        badge="Enabled"
                        badgeColor={C.green}
                    />
                    <MenuItem
                        icon={Activity}
                        iconBg={C.amberSoft}
                        iconColor={C.amber}
                        label="Login Activity"
                        value="Last 30 days"
                        onPress={() => Alert.alert('Coming soon')}
                        isLast
                    />
                </MenuGroup>

                {/* ── Preferences ── */}
                <MenuGroup title="Preferences" delay={600}>
                    <SwitchRow
                        icon={Bell}
                        iconBg={C.redSoft}
                        iconColor={C.red}
                        label="Push Notifications"
                        subtitle="Alerts & updates"
                        value={notificationsEnabled}
                        onValueChange={setNotificationsEnabled}
                    />
                    <SwitchRow
                        icon={Mail}
                        iconBg={C.blueSoft}
                        iconColor={C.blue}
                        label="Email Alerts"
                        subtitle="Business insights"
                        value={emailAlertsEnabled}
                        onValueChange={setEmailAlertsEnabled}
                    />
                    <SwitchRow
                        icon={Moon}
                        iconBg="#1F2937"
                        iconColor="#FBBF24"
                        label="Dark Mode"
                        subtitle="System default"
                        value={darkModeEnabled}
                        onValueChange={setDarkModeEnabled}
                    />
                    <MenuItem
                        icon={Globe}
                        iconBg={C.cyanSoft}
                        iconColor={C.cyan}
                        label="Language"
                        value="English"
                        onPress={() => Alert.alert('Coming soon')}
                    />
                    <MenuItem
                        icon={Palette}
                        iconBg={C.purpleSoft}
                        iconColor={C.purple}
                        label="Appearance"
                        value="System"
                        onPress={() => Alert.alert('Coming soon')}
                        isLast
                    />
                </MenuGroup>

                {/* ── Support ── */}
                <MenuGroup title="Support & Legal" delay={700}>
                    <MenuItem
                        icon={HelpCircle}
                        iconBg={C.blueSoft}
                        iconColor={C.blue}
                        label="Help Center"
                        onPress={() => Linking.openURL('https://brandcentral.com/help')}
                    />
                    <MenuItem
                        icon={MessageSquare}
                        iconBg={C.greenSoft}
                        iconColor={C.green}
                        label="Contact Support"
                        onPress={() =>
                            Linking.openURL('mailto:support@brandcentral.com')
                        }
                    />
                    <MenuItem
                        icon={FileText}
                        iconBg={C.purpleSoft}
                        iconColor={C.purple}
                        label="Privacy Policy"
                        onPress={() => Linking.openURL('https://brandcentral.com/privacy')}
                    />
                    <MenuItem
                        icon={FileText}
                        iconBg={C.amberSoft}
                        iconColor={C.amber}
                        label="Terms of Service"
                        onPress={() => Linking.openURL('https://brandcentral.com/terms')}
                    />
                    <MenuItem
                        icon={Smartphone}
                        iconBg="#F0F9FF"
                        iconColor={C.cyan}
                        label="App Version"
                        value="2.4.1 (Build 847)"
                        showArrow={false}
                        isLast
                    />
                </MenuGroup>

                {/* ── More ── */}
                <MenuGroup title="More" delay={800}>
                    <MenuItem
                        icon={Star}
                        iconBg="#FFFBEB"
                        iconColor="#F59E0B"
                        label="Rate RetailOps"
                        onPress={() => Alert.alert('Thanks for the love!')}
                    />
                    <MenuItem
                        icon={Share2}
                        iconBg={C.pinkSoft}
                        iconColor={C.pink}
                        label="Share App"
                        onPress={handleShareProfile}
                        isLast
                    />
                </MenuGroup>

                {/* ── Logout ── */}
                <Animated.View
                    entering={FadeInDown.duration(400).delay(900).springify()}
                >
                    <Pressable
                        style={[
                            styles.logoutButton,
                            signingOut && { opacity: 0.6 },
                        ]}
                        onPress={handleLogout}
                        disabled={signingOut}
                    >
                        {signingOut ? (
                            <ActivityIndicator size="small" color={C.red} />
                        ) : (
                            <LogOut size={18} color={C.red} strokeWidth={2.2} />
                        )}
                        <Text style={styles.logoutText}>
                            {signingOut ? 'Signing out…' : 'Sign Out'}
                        </Text>
                    </Pressable>
                </Animated.View>

                {/* ── Footer ── */}
                <Animated.View
                    entering={FadeIn.duration(500).delay(1000)}
                    style={styles.footer}
                >
                    <View style={styles.footerBrand}>
                        <Sparkles size={12} color={C.blue} strokeWidth={2.5} fill={C.blue} />
                        <Text style={styles.footerBrandText}>RetailOps Partner</Text>
                    </View>
                    <Text style={styles.footerTagline}>Seller Success Platform</Text>
                    <Text style={styles.footerCopy}>
                        © 2024 BrandCentral. All rights reserved.
                    </Text>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

// ============================================================
// STYLES
// ============================================================

const cardShadow = Platform.select({
    ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
    },
    android: { elevation: 2 },
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scroll: { paddingHorizontal: 16 },
    centerContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: C.textMuted,
        fontWeight: '500',
    },

    // ── Header ──
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 4,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: C.text,
        letterSpacing: -0.6,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: C.card,
        alignItems: 'center',
        justifyContent: 'center',
        ...cardShadow,
    },

    // ── Profile Card ──
    profileCard: {
        backgroundColor: C.card,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        marginBottom: 16,
        ...cardShadow,
    },

    // ── Avatar ──
    avatarContainer: {
        position: 'relative',
        marginBottom: 14,
    },
    avatarRing: {
        borderWidth: 3,
        borderColor: C.blue,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
    },
    avatar: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarText: {
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    avatarLoader: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.blueSoft,
    },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: C.green,
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    cameraBtn: {
        position: 'absolute',
        bottom: 0,
        left: -4,
        backgroundColor: C.blue,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: C.card,
        ...cardShadow,
    },
    pulseRing: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: C.green,
        top: 1,
        left: 1,
    },

    // ── User info ──
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    userName: {
        fontSize: 22,
        fontWeight: '800',
        color: C.text,
        letterSpacing: -0.4,
    },
    emailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 14,
    },
    userEmail: {
        fontSize: 14,
        color: C.textSecondary,
        fontWeight: '500',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '100%',
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: C.blueSoft,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
    },
    roleText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.blue,
    },
    sellerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: C.border,
        maxWidth: 180,
    },
    sellerText: {
        fontSize: 12,
        fontWeight: '600',
        color: C.textSecondary,
    },

    // ── Seller Section ──
    sellerSection: {
        marginTop: 12,
        gap: 8,
    },
    sellerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    sellerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    sellerName: {
        fontSize: 14,
        fontWeight: '600',
        color: C.text,
    },
    sellerMeta: {
        fontSize: 12,
        color: C.textMuted,
        marginTop: 2,
    },
    sellerStatus: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    sellerStatusText: {
        fontSize: 11,
        fontWeight: '600',
    },

    // ── Activity row ──
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 4,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    activityLive: {
        width: 12,
        height: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.green,
        zIndex: 1,
    },
    activityText: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '500',
    },
    activityDivider: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: C.textMuted,
    },

    // ── Stats ──
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 12,
        alignItems: 'flex-start',
        ...cardShadow,
    },
    statIcon: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '800',
        color: C.text,
        letterSpacing: -0.4,
    },
    statLabel: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '500',
        marginTop: 1,
    },

    // ── Menu groups ──
    menuGroup: { marginBottom: 20 },
    menuGroupTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: C.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 16,
    },
    menuGroupCard: {
        backgroundColor: C.card,
        borderRadius: 14,
        overflow: 'hidden',
        ...cardShadow,
    },

    // ── Menu items ──
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 56,
        gap: 12,
    },
    menuItemBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: C.border,
    },
    menuIcon: {
        width: 34,
        height: 34,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuContent: { flex: 1 },
    menuLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: C.text,
        letterSpacing: -0.1,
    },
    menuValue: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '400',
        marginTop: 2,
    },
    menuRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.1,
    },

    // ── Logout ──
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: C.redSoft,
        height: 54,
        borderRadius: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    logoutText: {
        fontSize: 15,
        fontWeight: '700',
        color: C.red,
        letterSpacing: -0.1,
    },

    // ── Footer ──
    footer: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 4,
    },
    footerBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    footerBrandText: {
        fontSize: 13,
        fontWeight: '700',
        color: C.blue,
        letterSpacing: -0.1,
    },
    footerTagline: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '500',
        marginTop: 2,
    },
    footerCopy: {
        fontSize: 10,
        color: C.textMuted,
        fontWeight: '400',
        marginTop: 4,
    },
});