import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import {
  InsightsIcon,
  LimitsIcon,
  SettingsIcon,
  TodayIcon,
} from '@/components/tab-icons';
import { Ink, Surface, Type } from '@/constants/theme';

/**
 * Four tabs, replacing the stack of buttons that used to sit at the bottom of the
 * dashboard — reaching Settings meant scrolling past every chart first.
 *
 * A JS `Tabs` rather than `NativeTabs`: native tabs want Android drawables for their
 * icons, which would put the navigation's icons inside the native module's `res/`
 * and couple two things that have no reason to know about each other.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Surface.page },
        headerTintColor: Ink.primary,
        headerTitleStyle: Type.heading,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: Surface.page },
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: Ink.primary,
        tabBarInactiveTintColor: Ink.muted,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => <TodayIcon color={color} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => <InsightsIcon color={color} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="limits"
        options={{
          title: 'Limits',
          tabBarIcon: ({ color, focused }) => <LimitsIcon color={color} active={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => <SettingsIcon color={color} active={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Surface.card,
    borderTopColor: Surface.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 62,
    paddingTop: 6,
    paddingBottom: 8,
  },
  label: { ...Type.tick, fontWeight: '500' },
  item: { paddingVertical: 2 },
});
