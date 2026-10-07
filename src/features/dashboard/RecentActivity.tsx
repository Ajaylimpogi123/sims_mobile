import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { dashboardKeys, setActivityRead } from '@/api/dashboard';
import { useMarkRead } from '@/api/notifications';
import type { ActivityItem, MeResponse } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelativeDateTime } from '@/lib/datetime';
import { hrefForTarget, openHref } from '@/navigation/targets';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/Text';

/**
 * The website's "Recent Activity" card (notification rows). Own unread rows are marked read when
 * tapped; a supervisor's view of a student's notification (is_own = false) only opens its target,
 * like the web, so the student's notification stays unread.
 */
export function RecentActivity({ items, me }: { items: ActivityItem[]; me: MeResponse | null }) {
  const queryClient = useQueryClient();
  const markRead = useMarkRead();

  const open = (item: ActivityItem, href: Href | null) => {
    if (item.is_own && !item.read_at) {
      setActivityRead(queryClient, item.id, new Date().toISOString());
      markRead.mutate(item.id, {
        onError: () => void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard }),
      });
    }
    openHref(href);
  };

  return (
    <Card title="Recent Activity">
      {items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No recent activity"
          message="Notifications will show up here as things happen."
        />
      ) : (
        <View>
          {items.map((item, index) => {
            const href = hrefForTarget(item.target, me);
            const unread = !item.read_at;
            const when = formatRelativeDateTime(item.created_at);
            const tappable = !!href || (item.is_own && unread);
            const content = (
              <>
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    {unread ? <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                    <Text className="flex-1 text-sm font-medium text-gray-900" numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                  {item.message ? (
                    <Text className="text-xs leading-4 text-gray-500" numberOfLines={2}>
                      {item.message}
                    </Text>
                  ) : null}
                  <Text className="text-xs text-gray-500">{when}</Text>
                </View>
                {href ? <Ionicons name="chevron-forward" size={16} color={colors.gray400} /> : null}
              </>
            );
            const row = `flex-row items-center gap-3 py-3 ${index > 0 ? 'border-t border-gray-100' : ''}`;
            const label = `${unread ? 'New. ' : ''}${item.title}. ${item.message ?? ''} ${when}`;
            return tappable ? (
              <Pressable
                key={item.id}
                onPress={() => open(item, href)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint={href ? 'Opens the related screen' : 'Marks it as read'}
                android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                className={`${row} active:bg-gray-50`}>
                {content}
              </Pressable>
            ) : (
              <View key={item.id} className={row} accessible accessibilityLabel={label}>
                {content}
              </View>
            );
          })}
        </View>
      )}
      <Pressable
        onPress={() => router.push('/notifications')}
        accessibilityRole="link"
        className="mt-1 min-h-11 items-center justify-center rounded-lg active:bg-brand-50">
        <Text className="text-sm font-medium text-brand-700">View all notifications</Text>
      </Pressable>
    </Card>
  );
}
