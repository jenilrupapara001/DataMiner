/**
 * RetailOps Partner — Messages Screen
 */

import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle } from 'lucide-react-native';

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        <View style={styles.emptyState}>
          <View style={styles.iconContainer}>
            <MessageCircle size={40} color="#94A3B8" strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Chat with your team and brand managers</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  content: { flex: 1, paddingHorizontal: 16 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
});
