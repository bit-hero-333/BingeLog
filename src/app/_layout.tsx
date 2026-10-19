import React, { useEffect } from 'react';
import { Platform, BackHandler, ToastAndroid } from 'react-native';
import { Tabs, router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MediaProvider, useMedia } from '@/context/MediaContext';
import { ThemeProvider, useAppTheme } from '@/context/ThemeContext';

function TabLayoutContent() {
  const { trackedItems } = useMedia();
  const { isDark, colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let lastBackPress = 0;
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // If navigation can go back in tab history, pop previous page
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true;
      }

      // Root level double back to exit
      const now = Date.now();
      if (now - lastBackPress < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPress = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    });

    return () => {
      backSubscription.remove();
    };
  }, [navigation]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      try {
        router.navigate('/mylist');
      } catch {
        // Safe fallback
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Dynamic bottom padding so Android gesture bar or hardware navigation never overlaps icons
  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;
  const tabHeight = 56 + bottomInset;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.headerBg,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '800',
            fontSize: 18,
            letterSpacing: 0.3,
          },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: colors.tabBg,
            borderTopColor: colors.tabBorder,
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: bottomInset,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Discover',
            headerTitle: 'BingeLog',
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
              backgroundColor: colors.primary,
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
          name="stats"
          options={{
            title: 'Stats',
            headerTitle: 'Media Insights',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart-outline" size={size} color={color} />
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
        <Tabs.Screen
          name="achievements"
          options={{
            href: null,
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MediaProvider>
          <TabLayoutContent />
        </MediaProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
