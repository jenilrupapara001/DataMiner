/**
 * RetailOps Partner — Home Screen
 *
 * Dashboard with KPI cards and quick actions.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TrendingUp,
  TrendingDown,
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Plus,
  Bell,
  Search,
  MessageCircle,
} from 'lucide-react-native';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Welcome Back</Text>
          <Text style={styles.name}>BrandCentral Connect</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.iconButton}>
            <Search size={20} color="#64748B" />
          </View>
          <View style={styles.iconButton}>
            <Bell size={20} color="#64748B" />
            <View style={styles.notificationDot} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ticket size={20} color="#2563EB" />
            </View>
            <Text style={styles.kpiValue}>127</Text>
            <Text style={styles.kpiLabel}>Open Tickets</Text>
            <View style={styles.kpiTrend}>
              <TrendingUp size={14} color="#16A34A" />
              <Text style={[styles.kpiTrendText, { color: '#16A34A' }]}>+12%</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#FFFBEB' }]}>
              <Clock size={20} color="#D97706" />
            </View>
            <Text style={styles.kpiValue}>23</Text>
            <Text style={styles.kpiLabel}>Pending</Text>
            <View style={styles.kpiTrend}>
              <TrendingDown size={14} color="#16A34A" />
              <Text style={[styles.kpiTrendText, { color: '#16A34A' }]}>-5%</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#F0FDF4' }]}>
              <CheckCircle size={20} color="#16A34A" />
            </View>
            <Text style={styles.kpiValue}>89</Text>
            <Text style={styles.kpiLabel}>Resolved</Text>
            <View style={styles.kpiTrend}>
              <TrendingUp size={14} color="#16A34A" />
              <Text style={[styles.kpiTrendText, { color: '#16A34A' }]}>+24%</Text>
            </View>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#FEF2F2' }]}>
              <AlertCircle size={20} color="#DC2626" />
            </View>
            <Text style={styles.kpiValue}>5</Text>
            <Text style={styles.kpiLabel}>Escalated</Text>
            <View style={styles.kpiTrend}>
              <TrendingUp size={14} color="#DC2626" />
              <Text style={[styles.kpiTrendText, { color: '#DC2626' }]}>+2</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <View style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
                <Plus size={24} color="#2563EB" />
              </View>
              <Text style={styles.actionLabel}>Raise Ticket</Text>
            </View>
            <View style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#F5F3FF' }]}>
                <MessageCircle size={24} color="#7C3AED" />
              </View>
              <Text style={styles.actionLabel}>AI Assistant</Text>
            </View>
            <View style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#F0FDF4' }]}>
                <TrendingUp size={24} color="#16A34A" />
              </View>
              <Text style={styles.actionLabel}>Analytics</Text>
            </View>
            <View style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#FFF7ED' }]}>
                <Clock size={24} color="#EA580C" />
              </View>
              <Text style={styles.actionLabel}>SLA Tracker</Text>
            </View>
          </View>
        </View>

        {/* Recent Tickets */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Tickets</Text>
            <View style={styles.viewAll}>
              <Text style={styles.viewAllText}>View All</Text>
              <ArrowRight size={14} color="#2563EB" />
            </View>
          </View>

          {/* Ticket items would go here */}
          <View style={styles.emptyState}>
            <Ticket size={48} color="#E2E8F0" />
            <Text style={styles.emptyTitle}>No recent tickets</Text>
            <Text style={styles.emptyDescription}>
              Create a new ticket to get started
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  kpiTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiTrendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563EB',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 16,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
});
