import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { approvalKeys, useApprovalCount } from '@/api/approvals';
import { useUnreadCountPolling } from '@/api/notifications';
import { useNavigationAccess } from '@/auth/AuthProvider';
import type { FeatureKey } from '@/navigation/access';
import { colors } from '@/theme/colors';

import { NotificationBell } from './NotificationBell';

export interface TabRoute {
  /** Route file name inside the group folder, e.g. "index", "attendance", "more". */
  name: string;
  /** Feature it shows; whether it's a tab for this user comes from src/navigation/access.ts. */
  feature: FeatureKey;
  /** Hide the tab navigator's header (for tabs that render their own stack). */
  headerShown?: boolean;
}

/**
 * Bottom tabs with the SIMS green header and the notification bell. `routes` lists every tab route file in the group,
 * in display order; only the ones in the user's navigation are mounted (Tabs.Protected),
 * so a hidden tab can't be opened by URL either.
 */
export function RoleTabs({ routes }: { routes: TabRoute[] }) {
  const navigation = useNavigationAccess();
  const hasApprovals = navigation.tabs.some((t) => t.key === 'approvals');
  const { data: pendingApprovals = 0 } = useApprovalCount(hasApprovals);

  return (
    <>
      <BadgePoller approvals={hasApprovals} />
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.brand700 },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '600' },
          headerRight: () => <NotificationBell />,
          tabBarActiveTintColor: colors.brand700,
          tabBarInactiveTintColor: colors.gray500,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}>
        {routes.map((route) => {
          const tab = navigation.tabs.find((t) => t.key === route.feature);
          return (
            // Keep "index" while the group is being torn down after logout (a navigator needs one screen).
            <Tabs.Protected key={route.name} guard={!!tab || (navigation.tabs.length === 0 && route.name === 'index')}>
              <Tabs.Screen
                name={route.name}
                options={{
                  title: tab?.title,
                  tabBarLabel: tab?.tabLabel ?? tab?.title,
                  headerShown: route.headerShown ?? true,
                  tabBarBadge:
                    route.feature === 'approvals' && pendingApprovals > 0 ? (pendingApprovals > 99 ? '99+' : pendingApprovals) : undefined,
                  tabBarBadgeStyle: { backgroundColor: colors.red600, color: colors.white, fontSize: 10, fontWeight: '600' },
                  tabBarIcon: ({ color, size, focused }) =>
                    tab ? <Ionicons name={focused ? tab.iconFocused : tab.icon} size={size} color={color} /> : null,
                }}
              />
            </Tabs.Protected>
          );
        })}
      </Tabs>
    </>
  );
}

/**
 * THE one badge poller per session (one role group is mounted at a time; Notifications sits above it).
 * The bell's unread count polls every 60 s in the foreground; the Pending Approvals count is refreshed
 * on the same beat (when stale), so there is still one timer. Renders nothing, so polling never
 * re-renders the tab navigator.
 */
function BadgePoller({ approvals }: { approvals: boolean }) {
  const queryClient = useQueryClient();
  const polledAt = useUnreadCountPolling();
  useEffect(() => {
    if (approvals && polledAt > 0) {
      void queryClient.refetchQueries({ queryKey: approvalKeys.count, stale: true, type: 'active' });
    }
  }, [approvals, polledAt, queryClient]);
  return null;
}
