import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  InsightsIcon,
  LimitsIcon,
  SettingsIcon,
  TodayIcon,
} from '@/components/tab-icons';
import { Candy, Font, Ink, Lift, Surface, Type } from '@/constants/theme';

/**
 * Four tabs on a floating, rounded bar. The selected tab sits on a soft violet pill,
 * so selection reads from shape (pill + filled icon) as well as colour.
 *
 * A JS `Tabs` rather than `NativeTabs`: native tabs want Android drawables for their
 * icons, which would put the navigation's icons inside the native module's `res/`.
 */
function Icon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return <View style={[styles.iconPill, focused && styles.iconPillOn]}>{children}</View>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Surface.page },
        headerTintColor: Ink.primary,
        headerTitleStyle: { ...Type.title },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: Surface.page },
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: Candy.violet,
        tabBarInactiveTintColor: Ink.muted,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Icon focused={focused}>
              <TodayIcon color={color} active={focused} />
            </Icon>
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, focused }) => (
            <Icon focused={focused}>
              <InsightsIcon color={color} active={focused} />
            </Icon>
          ),
        }}
      />
      <Tabs.Screen
        name="limits"
        options={{
          title: 'Limits',
          tabBarIcon: ({ color, focused }) => (
            <Icon focused={focused}>
              <LimitsIcon color={color} active={focused} />
            </Icon>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Icon focused={focused}>
              <SettingsIcon color={color} active={focused} />
            </Icon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    height: 72,
    borderRadius: 28,
    backgroundColor: Surface.card,
    borderTopWidth: 0,
    paddingTop: 8,
    paddingBottom: 8,
    ...Lift,
    shadowOpacity: 0.18,
    elevation: 10,
  },
  label: { ...Type.tick, fontFamily: Font.bold, marginTop: 2 },
  item: { paddingVertical: 2 },
  iconPill: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillOn: { backgroundColor: Candy.violetSoft },
});
