import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaProvider, useMedia } from '@/context/MediaContext';

function TabLayoutContent() {
  const { trackedItems } = useMedia();
  const insets = useSafeAreaInsets();

  // Dynamic bottom padding so Android gesture bar or hardware navigation never overlaps icons
  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;
  const tabHeight = 56 + bottomInset;

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: {
            backgroundColor: '#0d0f15',
          },
          headerTintColor: '#f8fafc',
          headerTitleStyle: {
            fontWeight: '800',
            fontSize: 18,
            letterSpacing: 0.3,
          },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: '#0d0f15',
            borderTopColor: '#1e2433',
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: bottomInset,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#38bdf8',
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Discover',
            headerTitle: 'Personal Media Tracker',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="compass-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="mylist"
          options={{
            title: 'My List',
            headerTitle: 'My Watchlist',
            tabBarBadge: trackedItems.length > 0 ? trackedItems.length : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: '700',
            },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bookmark-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerTitle: 'App Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <MediaProvider>
        <TabLayoutContent />
      </MediaProvider>
    </SafeAreaProvider>
  );
}
