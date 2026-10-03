import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  ToastAndroid,
  View,
} from 'react-native';

import { toApiError } from '@/api/errors';
import {
  notificationKeys,
  useMarkAllRead,
  useMarkRead,
  useNotificationsList,
  useUnreadCount,
} from '@/api/notifications';
import type { AppNotification } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { formatRelativeDateTime } from '@/lib/datetime';
import { featureInfo } from '@/navigation/access';
import { hrefForTarget, navigateToTarget } from '@/navigation/targets';
import { colors } from '@/theme/colors';

function toast(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function NotificationRow({
  item,
  canOpen,
  onPress,
}: {
  item: AppNotification;
  canOpen: boolean;
  onPress: (item: AppNotification) => void;
}) {
  const unread = !item.read_at;
  const when = formatRelativeDateTime(item.created_at);

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'New. ' : ''}${item.title}. ${item.message ?? ''} ${when}`}
      accessibilityHint={canOpen ? 'Opens the related screen' : unread ? 'Marks it as read' : undefined}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      // Same unread tint and "New" pill as the website's Notifications table.
      className={`flex-row items-center gap-3 border-b border-gray-100 px-4 py-3.5 ${unread ? 'bg-emerald-50/60' : 'bg-white'}`}>
      <View className="flex-1 gap-1">
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 text-base font-medium text-gray-900" numberOfLines={2}>
            {item.title}
          </Text>
          {unread ? (
            <View className="mt-0.5 rounded-full bg-emerald-100 px-2 py-0.5">
              <Text className="text-xs font-medium text-emerald-700">New</Text>
            </View>
          ) : (
            <Text className="mt-0.5 py-0.5 text-xs text-gray-500">Read</Text>
          )}
        </View>
        {item.message ? (
          <Text className="text-sm leading-5 text-gray-600" numberOfLines={3}>
            {item.message}
          </Text>
        ) : null}
        <Text className="text-xs text-gray-500">{when}</Text>
      </View>
      {canOpen ? <Ionicons name="chevron-forward" size={18} color={colors.gray400} /> : null}
    </Pressable>
  );
}

function SkeletonRows() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }} accessibilityLabel="Loading notifications" accessible>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} className="gap-2 border-b border-gray-100 bg-white px-4 py-4">
          <View className={`h-4 rounded bg-gray-200 ${i % 2 ? 'w-1/2' : 'w-2/3'}`} />
          <View className="h-3 w-full rounded bg-gray-100" />
          <View className="h-3 w-1/4 rounded bg-gray-100" />
        </View>
      ))}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Notifications for every role (website: Notifications/Index.jsx). Tapping a row marks it read and
 * opens the screen its target points to, if this role may open it (src/navigation/targets.ts);
 * otherwise it's only marked read.
 */
export function NotificationsScreen() {
  const { me, user } = useAuth();
  const queryClient = useQueryClient();
  const list = useNotificationsList();
  const unreadCount = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const [pulling, setPulling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fresh list and badge whenever the screen is shown (only refetches what's stale).
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({ queryKey: notificationKeys.all, stale: true, type: 'active' });
    }, [queryClient]),
  );

  // A stored cursor the server no longer accepts (422 on `cursor`): start again from the first page,
  // at most once per visit, so a server that rejected its own cursors can't cause a reset loop
  // (a second time, the footer's error with Try again shows instead).
  const listError = list.error;
  const cursorResetDone = useRef(false);
  useEffect(() => {
    if (!listError || cursorResetDone.current) return;
    const apiError = toApiError(listError);
    if (apiError.kind === 'validation' && apiError.fieldErrors.cursor) {
      cursorResetDone.current = true;
      void queryClient.resetQueries({ queryKey: notificationKeys.list });
    }
  }, [listError, queryClient]);

  const items = list.data?.pages.flatMap((page) => page.data) ?? [];
  const unread = unreadCount.data ?? items.filter((item) => !item.read_at).length;

  const refresh = async () => {
    setPulling(true);
    setActionError(null);
    try {
      await Promise.all([list.refetch(), unreadCount.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  const open = (item: AppNotification) => {
    setActionError(null);
    if (!item.read_at) {
      markRead.mutate(item.id, {
        onError: (error) => {
          const apiError = toApiError(error);
          // 404: deleted meanwhile; the list refetch drops it. 401 is handled app-wide.
          if (apiError.kind !== 'not_found' && !apiError.endsSession) toast(apiError.message);
        },
      });
    }
    if (!navigateToTarget(item.target, me)) {
      toast(item.read_at ? "There's no screen to open for this notification." : 'Marked as read.');
    }
  };

  const markAll = () => {
    setActionError(null);
    markAllRead.mutate(undefined, {
      onError: (error) => {
        const apiError = toApiError(error);
        if (!apiError.endsSession) setActionError(apiError.message);
      },
    });
  };

  const header = (
    <View className="gap-3 px-4 pb-3 pt-4">
      <Text className="text-sm text-gray-600">{featureInfo('notifications', user?.role_id).description}</Text>
      {list.isRefetchError && items.length > 0 ? (
        <Banner tone="warning" message={`Showing saved notifications. ${toApiError(list.error).message}`} />
      ) : null}
      {actionError ? <Banner message={actionError} /> : null}
      {items.length > 0 ? (
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium text-gray-700" style={{ fontVariant: ['tabular-nums'] }}>
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </Text>
          {unread > 0 ? (
            <Pressable
              onPress={markAll}
              disabled={markAllRead.isPending}
              accessibilityRole="button"
              accessibilityState={{ disabled: markAllRead.isPending, busy: markAllRead.isPending }}
              hitSlop={8}
              className="min-h-11 flex-row items-center gap-2 rounded-lg px-2 active:bg-brand-50">
              {markAllRead.isPending ? <ActivityIndicator size="small" color={colors.brand700} /> : null}
              <Text className="text-sm font-medium text-brand-700">Mark all as read</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  if (list.isPending) {
    return (
      <View className="flex-1 bg-gray-50">
        {header}
        <SkeletonRows />
      </View>
    );
  }

  if (list.isError && items.length === 0) {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Banner message={toApiError(list.error).message} />
        <Button label="Try again" variant="outline" onPress={() => void list.refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      contentContainerClassName="pb-10"
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <NotificationRow item={item} canOpen={hrefForTarget(item.target, me) !== null} onPress={open} />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View className="items-center gap-3 px-6 py-16">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Ionicons name="notifications-off-outline" size={26} color={colors.gray500} />
          </View>
          {/* Same empty text as the website. */}
          <Text className="text-center text-sm text-gray-500">No notifications yet.</Text>
        </View>
      }
      ListFooterComponent={
        list.isFetchingNextPage ? (
          <View className="py-6">
            <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more notifications" />
          </View>
        ) : list.isFetchNextPageError ? (
          <View className="items-center gap-2 px-4 py-6">
            <Text className="text-center text-sm text-gray-600">{toApiError(list.error).message}</Text>
            <Button label="Try again" variant="outline" onPress={() => void list.fetchNextPage()} />
          </View>
        ) : null
      }
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage && !list.isFetchNextPageError) void list.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
    />
  );
}
