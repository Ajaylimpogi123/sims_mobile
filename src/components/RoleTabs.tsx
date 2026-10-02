import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme/colors';

export interface TabSpec {
  /** Route file name inside the role folder, e.g. "index", "attendance". */
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
}

/** Bottom tabs with the SIMS green header, shared by the Student and Supervisor layouts. */
export function RoleTabs({ tabs }: { tabs: TabSpec[] }) {
  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand700 },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '600' },
          tabBarActiveTintColor: colors.brand700,
          tabBarInactiveTintColor: colors.slate500,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}>
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? tab.iconFocused : tab.icon} size={size} color={color} />
              ),
            }}
          />
        ))}
      </Tabs>
    </>
  );
}
