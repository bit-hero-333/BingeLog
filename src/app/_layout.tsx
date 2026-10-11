import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { MediaProvider, useMedia } from '@/context/MediaContext';

function TabLayoutContent() {
  const { trackedItems } = useMedia();

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
            height: 60,
            paddingBottom: 8,
            paddingTop: 6,
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
    <MediaProvider>
      <TabLayoutContent />
    </MediaProvider>
  );
}
