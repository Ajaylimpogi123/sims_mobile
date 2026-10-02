import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { notificationKeys, useUnreadCount } from '@/api/notifications';
import { colors } from '@/theme/colors';

/**
 * Header bell with the unread badge (same red "9+" badge as the website's NotificationBell).
 * Shown in the header of every role's tab screens; opens the Notifications screen.
 * The count refreshes when a screen with the bell gains focus, when the app returns to the
 * foreground, every 60 s while foregrounded, and right after marking notifications read.
 */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const { data: count = 0 } = useUnreadCount();

  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({ queryKey: notificationKeys.unreadCount, stale: true, type: 'active' });
    }, [queryClient]),
  );

  const badge = count > 9 ? '9+' : String(count);

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      hitSlop={4}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 22 }}
      className="mr-1 h-11 w-11 items-center justify-center rounded-full">
      <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={24} color={colors.white} />
      {count > 0 ? (
        <View
          importantForAccessibility="no-hide-descendants"
          className="absolute right-0.5 top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-brand-700 bg-red-600 px-1">
          <Text className="text-[10px] font-semibold leading-3 text-white" style={{ fontVariant: ['tabular-nums'] }}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
