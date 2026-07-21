import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/services/theme-context';

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () => (
          <LinearGradient
            colors={colors.tabBarGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.tabBarBorder,
          elevation: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Bubbles',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="map.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pages"
        options={{
          title: 'Pages',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="megaphone.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
