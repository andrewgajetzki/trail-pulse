import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ride',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={28}
              name="bicycle"
              color={color}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={28}
              name="clock.arrow.circlepath"
              color={color}
              weight={focused ? 'semibold' : 'regular'}
            />
          ),
        }}
      />
    </Tabs>
  );
}
