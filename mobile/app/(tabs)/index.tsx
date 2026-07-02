/**
 * RetailOps Partner — Dashboard (Overview Design)
 *
 * Full-featured analytics dashboard with:
 * - 4 KPI overview cards
 * - Sales Figures line chart with data point highlight
 * - Hit Rate + Deals stats
 * - Visitors sparkline
 * - Sales Report bar chart
 * - Year navigator with donut chart
 * - Retail sales locations breakdown
 * - New customers list
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  StatusBar,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  FileDown,
  TrendingUp,
  TrendingDown,
  Target,
  Check,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Mail,
  MoreHorizontal,
} from 'lucide-react-native';
import {
  LineChart,
  BarChart,
  PieChart,
} from 'react-native-gifted-charts';
import { useSeller } from '@/contexts/SellerContext';

// ============================================================
// CONSTANTS
// ============================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const COLORS = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  border: '#F1F5F9',
  blue: '#2563EB',
  blueSoft: '#EEF2FF',
  green: '#22C55E',
  greenSoft: '#DCFCE7',
  red: '#EF4444',
  amber: '#F59E0B',
  orange: '#F97316',
  pink: '#EC4899',
};

// ============================================================
// DATA
// ============================================================

const OVERVIEW_METRICS = [
  {
    id: 'sales',
    label: 'Sales',
    value: '$10289',
    trend: 2.5,
    trendUp: true,
    compare: 'Compared to\n($21340 last year)',
  },
  {
    id: 'purchase',
    label: 'Purchase',
    value: '$20921',
    trend: 0.5,
    trendUp: true,
    compare: 'Compared to\n($19000 last year)',
  },
  {
    id: 'return',
    label: 'Return',
    value: '$149',
    trend: -1.5,
    trendUp: false,
    compare: 'Compared to ($165\nlast year)',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    value: '$17390',
    trend: 2.5,
    trendUp: true,
    compare: 'Compared to\n($10500 last year)',
  },
];

// Sales Figures line data (May → Oct)
const MARKETING_SALES = [
  { value: 450, label: 'May' },
  { value: 550, label: 'Jun' },
  { value: 500, label: 'Jul' },
  { value: 580, label: 'Aug', dataPointText: '$27632', showStrictHighlight: true },
  { value: 480, label: 'Sep' },
  { value: 420, label: 'Oct' },
];

const CASES_SALES = [
  { value: 600, label: 'May' },
  { value: 500, label: 'Jun' },
  { value: 700, label: 'Jul' },
  { value: 550, label: 'Aug' },
  { value: 620, label: 'Sep' },
  { value: 500, label: 'Oct' },
];

// Visitors sparkline
const VISITORS_DATA = [
  { value: 40 }, { value: 45 }, { value: 42 }, { value: 50 },
  { value: 48 }, { value: 55 }, { value: 60 }, { value: 58 },
  { value: 65 }, { value: 62 }, { value: 70 },
];

// Sales Report bar chart
const SALES_REPORT = [
  { value: 800, label: 'Jan', frontColor: COLORS.blue },
  { value: 500, label: 'Jan', frontColor: COLORS.green, spacing: 22 },
  { value: 950, label: 'Feb', frontColor: COLORS.blue },
  { value: 620, label: 'Feb', frontColor: COLORS.green, spacing: 22 },
  { value: 780, label: 'Mar', frontColor: COLORS.blue },
  { value: 550, label: 'Mar', frontColor: COLORS.green, spacing: 22 },
  { value: 870, label: 'Apr', frontColor: COLORS.blue },
  { value: 600, label: 'Apr', frontColor: COLORS.green, spacing: 22 },
  { value: 1020, label: 'May', frontColor: COLORS.blue },
  { value: 700, label: 'May', frontColor: COLORS.green, spacing: 22 },
  { value: 1000, label: 'Jun', frontColor: COLORS.blue },
  { value: 520, label: 'Jun', frontColor: COLORS.green, spacing: 22 },
];

// Donut chart
const DONUT_DATA = [
  { value: 45, color: COLORS.blue, id: 'amazon' },
  { value: 25, color: COLORS.orange, id: 'shopify' },
  { value: 20, color: COLORS.green, id: 'ebay' },
  { value: 10, color: COLORS.red, id: 'alibaba' },
];

const DONUT_LEGEND = [
  { label: 'Amazon', value: '2.1k', color: COLORS.blue },
  { label: 'Alibaba', value: '1k', color: COLORS.red },
  { label: 'Ebay', value: '1.9k', color: COLORS.green },
  { label: 'Shopify', value: '15.7k', color: COLORS.orange },
];

// Retail sales
const RETAIL_SEGMENTS = [
  { label: 'Massive', value: '15.7k', color: COLORS.blue },
  { label: 'Large', value: '4.9k', color: COLORS.orange },
  { label: 'Medium', value: '2.4k', color: COLORS.amber },
  { label: 'Small', value: '980', color: '#CBD5E1' },
];

// Customers
const CUSTOMERS = [
  { id: '00222', name: 'Francis Holzworth', avatar: '#FDE68A' },
  { id: '00223', name: 'Kaylyn Yokel', avatar: '#DDD6FE' },
  { id: '00224', name: 'Kimberly Muro', avatar: '#FBCFE8' },
  { id: '00225', name: 'Jack Sause', avatar: '#BFDBFE' },
  { id: '00226', name: 'Rebekkah Lafantano', avatar: '#BBF7D0' },
];

// ============================================================
// OVERVIEW CARD
// ============================================================

function OverviewCard({
  metric,
  index,
}: {
  metric: (typeof OVERVIEW_METRICS)[number];
  index: number;
}) {
  const scale = useSharedValue(1);
  const TrendIcon = metric.trendUp ? TrendingUp : TrendingDown;
  const trendColor = metric.trendUp ? COLORS.green : COLORS.red;

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(400).delay(100 + index * 60).springify()}
      style={styles.overviewWrapper}
    >
      <AnimatedPressable
        style={[styles.overviewCard, style]}
        onPress={() => Haptics.selectionAsync()}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 300 });
        }}
      >
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewLabel}>{metric.label}</Text>
          <View style={styles.overviewTrend}>
            <Text style={[styles.overviewTrendText, { color: trendColor }]}>
              {metric.trendUp ? '+' : ''}
              {metric.trend}%
            </Text>
            <TrendIcon size={11} color={trendColor} strokeWidth={2.5} />
          </View>
        </View>
        <Text style={styles.overviewValue}>{metric.value}</Text>
        <Text style={styles.overviewCompare}>{metric.compare}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ============================================================
// LEGEND DOT
// ============================================================

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState(2017);
  const { sellers, selectedSeller, selectSeller } = useSeller();
  const [showSellerPicker, setShowSellerPicker] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.blue}
          />
        }
      >
        {/* ── Top Bar ── */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.topBar}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => Haptics.selectionAsync()}
            hitSlop={8}
          >
            <Menu size={24} color={COLORS.text} strokeWidth={2} />
          </Pressable>

          <View style={styles.searchBar}>
            <Search size={18} color={COLORS.textSecondary} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          {/* Brand Selector */}
          {sellers.length > 1 && (
            <Pressable
              style={styles.brandSelector}
              onPress={() => {
                Haptics.selectionAsync();
                setShowSellerPicker(!showSellerPicker);
              }}
            >
              <Text style={styles.brandText} numberOfLines={1}>
                {selectedSeller?.Name || 'Select Brand'}
              </Text>
              <ChevronDown size={14} color={COLORS.blue} strokeWidth={2.5} />
            </Pressable>
          )}

          <Pressable
            style={styles.iconBtn}
            onPress={() => Haptics.selectionAsync()}
            hitSlop={8}
          >
            <Bell size={24} color={COLORS.text} strokeWidth={2} />
            <View style={styles.notifDot} />
          </Pressable>
        </Animated.View>

        {/* Brand Picker Dropdown */}
        {showSellerPicker && sellers.length > 1 && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.brandPicker}>
            {sellers.map((seller) => (
              <Pressable
                key={seller.Id}
                style={[
                  styles.brandOption,
                  selectedSeller?.Id === seller.Id && styles.brandOptionSelected,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  selectSeller(seller);
                  setShowSellerPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.brandOptionText,
                    selectedSeller?.Id === seller.Id && styles.brandOptionTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {seller.Name}
                </Text>
                <Text style={styles.brandOptionMeta}>
                  {seller.Marketplace || 'Amazon'}{seller.SellerId ? ` • ${seller.SellerId}` : ''}
                </Text>
                {selectedSeller?.Id === seller.Id && (
                  <Check size={16} color={COLORS.blue} strokeWidth={2.5} />
                )}
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* ── Overview Header ── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(80)}
          style={styles.sectionHead}
        >
          <View>
            <Text style={styles.pageTitle}>Overview</Text>
            <Pressable
              style={styles.filterRow}
              onPress={() => Haptics.selectionAsync()}
            >
              <Text style={styles.filterLabel}>Show: </Text>
              <Text style={styles.filterValue}>This Year</Text>
              <ChevronDown size={14} color={COLORS.text} strokeWidth={2.5} />
            </Pressable>
          </View>

          <Pressable
            style={styles.downloadBtn}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <FileDown size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </Animated.View>

        {/* ── Overview Cards ── */}
        <View style={styles.overviewGrid}>
          {OVERVIEW_METRICS.map((metric, i) => (
            <OverviewCard key={metric.id} metric={metric} index={i} />
          ))}
        </View>

        {/* ── Sales Figures ── */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(400).springify()}
          style={styles.chartCard}
        >
          <Text style={styles.chartTitle}>Sales Figures</Text>

          <View style={styles.chartLegend}>
            <LegendDot color={COLORS.blue} label="Marketing Sales" />
            <LegendDot color={COLORS.green} label="Cases Sales" />
          </View>

          <View style={{ marginLeft: -16, marginTop: 8 }}>
            <LineChart
              data={MARKETING_SALES}
              data2={CASES_SALES}
              height={180}
              width={320}
              spacing={50}
              initialSpacing={20}
              color1={COLORS.blue}
              color2={COLORS.green}
              thickness={3}
              curved
              hideDataPoints
              dataPointsColor1={COLORS.blue}
              dataPointsColor2={COLORS.green}
              yAxisColor="transparent"
              xAxisColor="transparent"
              yAxisTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: COLORS.textSecondary, fontSize: 11 }}
              noOfSections={4}
              maxValue={1000}
              rulesType="solid"
              rulesColor="#F1F5F9"
              showValuesAsDataPointsText
              textShiftY={-8}
              textShiftX={-10}
              textColor1={COLORS.text}
              textFontSize={13}
              focusEnabled
              showDataPointOnFocus
              showStripOnFocus
              stripColor={COLORS.blue}
              stripOpacity={0.3}
              stripWidth={2}
              focusedDataPointColor={COLORS.blue}
              focusedDataPointRadius={7}
            />
          </View>

          {/* Highlight bubble for August */}
          <View style={styles.highlightBubble}>
            <Text style={styles.highlightValue}>$27632</Text>
            <Text style={styles.highlightMonth}>August</Text>
          </View>
        </Animated.View>

        {/* ── Hit Rate + Deals ── */}
        <View style={styles.statsRow}>
          <Animated.View
            entering={FadeInDown.duration(400).delay(500).springify()}
            style={styles.statCard}
          >
            <View style={[styles.statIcon, { backgroundColor: COLORS.blueSoft }]}>
              <Target size={20} color={COLORS.blue} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statValue}>68%</Text>
              <Text style={styles.statLabel}>Hit Rate this year</Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(400).delay(560).springify()}
            style={styles.statCard}
          >
            <View style={[styles.statIcon, { backgroundColor: COLORS.greenSoft }]}>
              <Briefcase size={20} color={COLORS.green} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statValue}>76%</Text>
              <Text style={styles.statLabel}>Deals this year</Text>
            </View>
          </Animated.View>
        </View>

        {/* ── Visitors ── */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(620).springify()}
          style={styles.visitorsCard}
        >
          <View style={styles.visitorsLeft}>
            <View style={styles.visitorsRow}>
              <Text style={styles.visitorsValue}>10,254</Text>
              <View style={styles.visitorsTrend}>
                <Text style={styles.visitorsTrendText}>1.5%</Text>
                <TrendingDown size={12} color={COLORS.red} strokeWidth={2.5} />
              </View>
            </View>
            <Text style={styles.visitorsLabel}>Visitors this year</Text>
          </View>

          <View style={styles.sparkline}>
            <LineChart
              data={VISITORS_DATA}
              height={40}
              width={140}
              hideAxesAndRules
              hideYAxisText
              hideDataPoints
              color={COLORS.blue}
              thickness={2.5}
              curved
              initialSpacing={0}
              endSpacing={0}
              adjustToWidth
            />
          </View>
        </Animated.View>

        {/* ── Sales Report ── */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(700).springify()}
          style={styles.chartCard}
        >
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Sales Report</Text>
            <Text style={styles.chartSubtitle}>2017-2018</Text>
          </View>

          <View style={styles.chartLegend}>
            <LegendDot color={COLORS.blue} label="Online Sales" />
            <LegendDot color={COLORS.green} label="Offline Sales" />
          </View>

          <View style={{ marginLeft: -16, marginTop: 8 }}>
            <BarChart
              data={SALES_REPORT}
              height={200}
              width={320}
              barWidth={12}
              spacing={4}
              initialSpacing={16}
              barBorderRadius={4}
              yAxisColor="transparent"
              xAxisColor="transparent"
              yAxisTextStyle={{ color: COLORS.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: COLORS.textSecondary, fontSize: 11 }}
              noOfSections={4}
              maxValue={1000}
              yAxisLabelPrefix="$"
              rulesType="solid"
              rulesColor="#F1F5F9"
            />
          </View>
        </Animated.View>

        {/* ── Year Navigator + Donut ── */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(800).springify()}
          style={styles.chartCard}
        >
          <View style={styles.yearNav}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setYear((y) => y - 1);
              }}
              hitSlop={8}
              style={styles.yearArrow}
            >
              <ChevronLeft size={22} color={COLORS.text} strokeWidth={2.5} />
            </Pressable>

            <Text style={styles.yearText}>{year}</Text>

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setYear((y) => y + 1);
              }}
              hitSlop={8}
              style={styles.yearArrow}
            >
              <ChevronRight size={22} color={COLORS.text} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.donutWrap}>
            <PieChart
              data={DONUT_DATA}
              donut
              radius={90}
              innerRadius={65}
              innerCircleColor={COLORS.card}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.donutValue}>22.870</Text>
                  <Text style={styles.donutLabel}>Visitors this year</Text>
                </View>
              )}
            />
          </View>

          <View style={styles.donutLegend}>
            {DONUT_LEGEND.map((item) => (
              <View key={item.label} style={styles.donutLegendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.donutLegendLabel}>{item.label}</Text>
                <Text style={styles.donutLegendValue}> {item.value}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Top Retail Sales Locations ── */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(900).springify()}
          style={styles.chartCard}
        >
          {/* Simplified map placeholder */}
          <View style={styles.mapContainer}>
            <View style={styles.mapPlaceholder}>
              <View style={styles.mapPin}>
                <Text style={styles.mapPinText}>United States</Text>
              </View>
              {/* Coloured regions */}
              <View style={[styles.mapRegion, { backgroundColor: COLORS.blue, top: 30, left: 40, width: 40, height: 20 }]} />
              <View style={[styles.mapRegion, { backgroundColor: COLORS.orange, top: 40, right: 60, width: 30, height: 25 }]} />
              <View style={[styles.mapRegion, { backgroundColor: COLORS.amber, top: 60, right: 40, width: 25, height: 15 }]} />
              <View style={[styles.mapRegion, { backgroundColor: COLORS.orange, bottom: 30, right: 30, width: 35, height: 20 }]} />
            </View>
          </View>

          <Text style={styles.locationTitle}>Top Retail Sales Locations</Text>

          <View style={styles.locationHeader}>
            <View style={styles.locationValueRow}>
              <Text style={styles.locationValue}>19.870</Text>
              <Text style={styles.locationFlag}>🇺🇸</Text>
            </View>

            <View style={styles.zoomButtons}>
              <Pressable
                style={styles.zoomBtn}
                onPress={() => Haptics.selectionAsync()}
              >
                <Plus size={16} color={COLORS.text} strokeWidth={2.5} />
              </Pressable>
              <Pressable
                style={styles.zoomBtn}
                onPress={() => Haptics.selectionAsync()}
              >
                <Minus size={16} color={COLORS.text} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.locationSubtitle}>Our most customers in U</Text>

          <View style={styles.segmentList}>
            {RETAIL_SEGMENTS.map((seg) => (
              <View key={seg.label} style={styles.segmentRow}>
                <View style={[styles.segmentDot, { backgroundColor: seg.color }]} />
                <Text style={styles.segmentLabel}>{seg.label}</Text>
                <Text style={styles.segmentValue}>{seg.value}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── New Customers ── */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(1000).springify()}
          style={styles.chartCard}
        >
          <View style={styles.customersHeader}>
            <Text style={styles.chartTitle}>New Customers</Text>
            <Pressable
              onPress={() => Haptics.selectionAsync()}
              hitSlop={8}
            >
              <MoreHorizontal size={20} color={COLORS.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          {CUSTOMERS.map((customer) => (
            <Pressable
              key={customer.id}
              style={styles.customerRow}
              onPress={() => Haptics.selectionAsync()}
            >
              <View style={[styles.customerAvatar, { backgroundColor: customer.avatar }]}>
                <Text style={styles.customerInitial}>
                  {customer.name.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{customer.name}</Text>
                <Text style={styles.customerId}>Customer ID#{customer.id}</Text>
              </View>
              <Pressable
                style={styles.mailBtn}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                hitSlop={8}
              >
                <Mail size={18} color={COLORS.textTertiary} strokeWidth={2} />
              </Pressable>
            </Pressable>
          ))}

          <Pressable
            style={styles.viewMoreBtn}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Text style={styles.viewMoreText}>VIEW MORE CUSTOMERS</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  searchBar: {
    flex: 1,
    height: 40,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    padding: 0,
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EC4899',
  },

  // ── Brand Selector ──
  brandSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.blueSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blue,
    maxWidth: 100,
  },
  brandPicker: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  brandOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  brandOptionSelected: {
    backgroundColor: COLORS.blueSoft,
  },
  brandOptionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  brandOptionTextSelected: {
    fontWeight: '600',
    color: COLORS.blue,
  },
  brandOptionMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginRight: 8,
  },

  // ── Section header ──
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  filterLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  downloadBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.blue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },

  // ── Overview cards ──
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  overviewWrapper: {
    width: '48%',
  },
  overviewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  overviewTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  overviewTrendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  overviewValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  overviewCompare: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '500',
    lineHeight: 15,
  },

  // ── Chart cards ──
  chartCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 4,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  chartSubtitle: {
    fontSize: 14,
    color: COLORS.textTertiary,
    fontWeight: '500',
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
  },
  highlightBubble: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  highlightValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  highlightMonth: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '500',
  },

  // ── Stat cards ──
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '500',
    marginTop: 1,
  },

  // ── Visitors ──
  visitorsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  visitorsLeft: {
    flex: 1,
  },
  visitorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visitorsValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  visitorsTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  visitorsTrendText: {
    fontSize: 11,
    color: COLORS.red,
    fontWeight: '700',
  },
  visitorsLabel: {
    fontSize: 12,
    color: COLORS.textTertiary,
    fontWeight: '500',
    marginTop: 4,
  },
  sparkline: {
    width: 140,
    height: 40,
  },

  // ── Year nav ──
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  yearArrow: {
    padding: 8,
  },
  yearText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
  },

  // ── Donut ──
  donutWrap: {
    alignItems: 'center',
    marginVertical: 12,
  },
  donutValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  donutLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
    fontWeight: '500',
    marginTop: 2,
  },
  donutLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
    rowGap: 10,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: 6,
  },
  donutLegendLabel: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  donutLegendValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700',
  },

  // ── Map ──
  mapContainer: {
    height: 140,
    marginBottom: 12,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  mapPin: {
    position: 'absolute',
    top: 40,
    left: 30,
    backgroundColor: COLORS.text,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    zIndex: 2,
  },
  mapPinText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mapRegion: {
    position: 'absolute',
    borderRadius: 4,
    opacity: 0.7,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  locationFlag: {
    fontSize: 22,
  },
  zoomButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  zoomBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationSubtitle: {
    fontSize: 13,
    color: COLORS.textTertiary,
    fontWeight: '500',
    marginBottom: 14,
  },
  segmentList: {
    gap: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  segmentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  segmentLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  segmentValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700',
  },

  // ── Customers ──
  customersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  customerId: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '500',
    marginTop: 2,
  },
  mailBtn: {
    padding: 6,
  },
  viewMoreBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  viewMoreText: {
    fontSize: 13,
    color: COLORS.blue,
    fontWeight: '700',
    letterSpacing: 1,
  },
});