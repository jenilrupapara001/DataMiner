/**
 * RetailOps Partner — Seller Selection Screen
 *
 * Shows after login when user has multiple sellers/brands.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Check,
  ChevronRight,
  Building2,
  Store,
  Globe,
  Package,
} from 'lucide-react-native';
import { useSeller, Seller } from '@/contexts/SellerContext';

// ============================================================
// COLORS
// ============================================================

const C = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textMuted: '#94A3B8',
  border: '#F1F5F9',
  blue: '#2563EB',
  blueSoft: '#EEF2FF',
  green: '#22C55E',
  greenSoft: '#DCFCE7',
};

const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 12 },
  android: { elevation: 2 },
});

// ============================================================
// SELLER CARD
// ============================================================

function SellerCard({
  seller,
  isSelected,
  onPress,
  index,
}: {
  seller: Seller;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const marketplaceColors: Record<string, { bg: string; color: string }> = {
    'amazon.in': { bg: '#FFF7ED', color: '#EA580C' },
    'amazon.com': { bg: '#EFF6FF', color: '#2563EB' },
    'flipkart': { bg: '#FEF3C7', color: '#D97706' },
    'meesho': { bg: '#FCE7F3', color: '#DB2777' },
  };

  const marketplace = seller.Marketplace?.toLowerCase() || 'amazon';
  const colors = marketplaceColors[marketplace] || marketplaceColors['amazon.in'];

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(100 + index * 60).springify()}>
      <AnimatedPressable
        style={[styles.sellerCard, animatedStyle, isSelected && styles.sellerCardSelected]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
      >
        {/* Marketplace Badge */}
        <View style={[styles.marketplaceBadge, { backgroundColor: colors.bg }]}>
          <Globe size={12} color={colors.color} strokeWidth={2.5} />
          <Text style={[styles.marketplaceText, { color: colors.color }]}>
            {seller.Marketplace || 'Amazon'}
          </Text>
        </View>

        {/* Seller Info */}
        <View style={styles.sellerInfo}>
          <View style={[styles.sellerIcon, { backgroundColor: C.blueSoft }]}>
            <Store size={20} color={C.blue} strokeWidth={2} />
          </View>
          <View style={styles.sellerDetails}>
            <Text style={styles.sellerName} numberOfLines={1}>{seller.Name}</Text>
            {seller.SellerId && (
              <Text style={styles.sellerId}>ID: {seller.SellerId}</Text>
            )}
            <View style={styles.sellerMeta}>
              <View style={[styles.planBadge, { backgroundColor: C.greenSoft }]}>
                <Text style={styles.planText}>{seller.Plan || 'Starter'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Selection Indicator */}
        <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
          {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ============================================================
// MAIN
// ============================================================

export default function SellerSelectionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sellers, selectedSeller, selectSeller } = useSeller();
  const [localSelected, setLocalSelected] = useState<string>(selectedSeller?.Id || '');

  const handleContinue = useCallback(async () => {
    const seller = sellers.find((s) => s.Id === localSelected);
    if (!seller) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await selectSeller(seller);
    router.replace('/(tabs)');
  }, [localSelected, sellers, selectSeller, router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400).delay(80)} style={styles.header}>
          <Text style={styles.pageTitle}>Select Brand</Text>
          <Text style={styles.pageSubtitle}>
            Choose which seller account you want to work with
          </Text>
        </Animated.View>

        {/* Seller List */}
        <View style={styles.sellerList}>
          {sellers.map((seller, i) => (
            <SellerCard
              key={seller.Id}
              seller={seller}
              isSelected={localSelected === seller.Id}
              onPress={() => setLocalSelected(seller.Id)}
              index={i}
            />
          ))}
        </View>

        {/* Continue Button */}
        <Animated.View entering={FadeInDown.duration(400).delay(300).springify()}>
          <Pressable
            style={[styles.continueButton, !localSelected && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!localSelected}
          >
            <Text style={styles.continueText}>Continue</Text>
            <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        </Animated.View>

        {/* Skip */}
        {sellers.length === 1 && (
          <Animated.View entering={FadeIn.duration(400).delay(400)}>
            <Pressable
              style={styles.skipButton}
              onPress={() => {
                Haptics.selectionAsync();
                selectSeller(sellers[0]);
                router.replace('/(tabs)');
              }}
            >
              <Text style={styles.skipText}>Skip — use only account</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16 },

  // Header
  header: { marginBottom: 24, paddingHorizontal: 2 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5, marginBottom: 8 },
  pageSubtitle: { fontSize: 15, color: C.textSecondary, lineHeight: 22 },

  // Seller List
  sellerList: { gap: 12, marginBottom: 24 },

  // Seller Card
  sellerCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    ...cardShadow,
  },
  sellerCardSelected: {
    borderColor: C.blue,
    backgroundColor: '#FAFBFF',
  },
  marketplaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  marketplaceText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sellerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sellerDetails: { flex: 1 },
  sellerName: { fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: -0.2, marginBottom: 2 },
  sellerId: { fontSize: 12, color: C.textMuted, marginBottom: 6 },
  sellerMeta: { flexDirection: 'row', gap: 8 },
  planBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  planText: { fontSize: 11, fontWeight: '600', color: '#166534' },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkCircleSelected: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },

  // Continue
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.blue,
    height: 56,
    borderRadius: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: C.blue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  continueButtonDisabled: { backgroundColor: '#93C5FD', shadowOpacity: 0, elevation: 0 },
  continueText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  // Skip
  skipButton: { alignItems: 'center', padding: 16 },
  skipText: { fontSize: 14, fontWeight: '500', color: C.textSecondary },
});
