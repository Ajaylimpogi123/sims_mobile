import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { isNoStudentProfile } from '@/api/attendance';
import { toApiError } from '@/api/errors';
import { useFeedbackList } from '@/api/feedback';
import type { FeedbackSummary } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors } from '@/theme/colors';

import { companySupervisorLine, formatFeedbackPeriod, formatRating } from './format';
import { Text } from '@/components/ui/Text';

function OverallRating({ item }: { item: FeedbackSummary }) {
  return (
    <View className="self-start rounded-lg border border-gray-200 bg-gray-50 px-3 py-1">
      <Text className="text-sm text-gray-700" style={{ fontVariant: ['tabular-nums'] }}>
        Overall Rating: <Text className="font-semibold text-gray-900">{formatRating(item.overall_rating)}</Text>/{item.rating_max}
      </Text>
    </View>
  );
}

function FeedbackRow({ item, onPress }: { item: FeedbackSummary; onPress: () => void }) {
  const period = formatFeedbackPeriod(item);
  const line = companySupervisorLine(item);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Evaluation ${period}, ${line}, ${item.status === 'locked' ? 'Locked' : 'Submitted'}, Overall Rating ${formatRating(item.overall_rating)} out of ${item.rating_max}`}
      accessibilityHint="Opens the evaluation"
      className="mx-4 mb-3 gap-3 rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50">
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-gray-900">{period}</Text>
          <Text className="text-sm text-gray-600">{line}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
      <OverallRating item={item} />
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <SkeletonPulse label="Loading feedback">
      {[0, 1, 2].map((i) => (
        <View key={i} className="mx-4 mb-3 gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <SkeletonBlock className="h-5 w-3/5" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </View>
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-7 w-36" />
        </View>
      ))}
    </SkeletonPulse>
  );
}

/** Student "My Feedback" tab (website: SupervisorEvaluations/MyFeedback.jsx). Read-only. */
export function FeedbackScreen() {
  const router = useRouter();
  const feedback = useFeedbackList();
  const [pulling, setPulling] = useState(false);
  const lastOpen = useRef(0);

  const open = useCallback(
    (id: number) => {
      // A quick double tap must not open the evaluation twice.
      const now = Date.now();
      if (now - lastOpen.current < 1000) return;
      lastOpen.current = now;
      router.push({ pathname: '/feedback/[id]', params: { id: String(id) } });
    },
    [router],
  );

  const refresh = async () => {
    setPulling(true);
    try {
      await feedback.refetch();
    } finally {
      setPulling(false);
    }
  };

  const noProfile = isNoStudentProfile(feedback.error);
  const items = noProfile ? [] : (feedback.data?.pages.flatMap((page) => page.data) ?? []);

  const header = (
    <View className="gap-3 px-4 pb-3 pt-4">
      <Text className="text-sm text-gray-600">Evaluations your supervisor has submitted about your internship performance</Text>
      {noProfile ? <Banner tone="warning" message={toApiError(feedback.error).message} /> : null}
      {!noProfile && feedback.isRefetchError ? (
        <Banner tone="warning" message={`Showing saved data. ${toApiError(feedback.error).message}`} />
      ) : null}
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (!noProfile) {
    if (feedback.isPending) empty = <ListSkeleton />;
    else if (feedback.isError) {
      empty = (
        <View className="px-4">
          <ErrorState message={toApiError(feedback.error).message} onRetry={() => void feedback.refetch()} retrying={feedback.isFetching} />
        </View>
      );
    } else {
      empty = <EmptyState icon="chatbox-ellipses-outline" message="No feedback has been submitted yet." />;
    }
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        className="flex-1"
        contentContainerClassName="pb-8"
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <FeedbackRow item={item} onPress={() => open(item.id)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          feedback.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more feedback" />
            </View>
          ) : feedback.isFetchNextPageError ? (
            <View className="items-center gap-2 px-4 py-6">
              <Text className="text-center text-sm text-gray-600">{toApiError(feedback.error).message}</Text>
              <Button label="Try again" variant="outline" onPress={() => void feedback.fetchNextPage()} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (feedback.hasNextPage && !feedback.isFetchingNextPage && !feedback.isFetchNextPageError) void feedback.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
      />
    </View>
  );
}
