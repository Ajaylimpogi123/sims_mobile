import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { MESSAGES, toApiError } from '@/api/errors';
import { feedbackFromList, useFeedback } from '@/api/feedback';
import type { FeedbackCategory, FeedbackDetail, FeedbackSummary } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/datetime';
import { colors } from '@/theme/colors';

import { formatFeedbackPeriod, formatRating } from './format';
import { RatingScale } from './RatingScale';
import { Text } from '@/components/ui/Text';

const NOT_FOUND = "We couldn't find that evaluation.";

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={16} color={colors.gray500} />
      <Text className="flex-1 text-sm text-gray-600">{text}</Text>
    </View>
  );
}

/** Period, status, company, supervisor, dates and the overall rating (website card header). */
function HeaderCard({ item }: { item: FeedbackSummary }) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <Text accessibilityRole="header" className="flex-1 text-xl font-semibold text-gray-900">
          {formatFeedbackPeriod(item)}
        </Text>
        <StatusBadge status={item.status} />
      </View>
      <View className="mt-3 gap-1.5">
        <Meta icon="business-outline" text={item.company?.name || '—'} />
        <Meta icon="person-outline" text={`Supervisor: ${item.supervisor?.name || '—'}`} />
        {item.submitted_at ? <Meta icon="time-outline" text={`Submitted ${formatDateTime(item.submitted_at)}`} /> : null}
        {item.locked_at ? <Meta icon="lock-closed-outline" text={`Locked ${formatDateTime(item.locked_at)}`} /> : null}
      </View>
      <View
        className="mt-4 flex-row items-baseline justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
        accessible
        accessibilityLabel={`Overall Rating: ${formatRating(item.overall_rating)} out of ${item.rating_max}`}>
        <Text className="text-sm text-gray-700">Overall Rating</Text>
        <Text className="text-sm text-gray-700" style={{ fontVariant: ['tabular-nums'] }}>
          <Text className="text-base font-semibold text-gray-900">{formatRating(item.overall_rating)}</Text>/{item.rating_max}
        </Text>
      </View>
    </Card>
  );
}

/** One category's criteria with their ratings and comments (website: CriteriaRatingGroup, read-only). */
export function CategorySection({ group }: { group: FeedbackCategory }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="px-1 text-sm font-semibold text-gray-900">
        {group.category}
      </Text>
      <View className="rounded-2xl border border-gray-200 bg-white px-4">
        {group.criteria.map((criterion, index) => (
          <View key={criterion.id} className={`gap-2 py-4 ${index > 0 ? 'border-t border-gray-200' : ''}`}>
            <View className="gap-0.5">
              <Text className="text-sm font-medium text-gray-900">{criterion.label}</Text>
              {criterion.description ? <Text className="text-xs text-gray-500">{criterion.description}</Text> : null}
            </View>
            <RatingScale rating={criterion.rating} />
            {criterion.comment ? (
              <Text selectable className="rounded-lg bg-gray-50 p-2 text-sm leading-5 text-gray-700">
                {criterion.comment}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Website ReadOnlyText: shown only when there is text. */
export function TextSection({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <Card title={label}>
      <Text selectable className="text-base leading-6 text-gray-900">
        {value}
      </Text>
    </Card>
  );
}

function Body({ evaluation }: { evaluation: FeedbackDetail }) {
  return (
    <>
      {evaluation.categories.length ? (
        evaluation.categories.map((group) => <CategorySection key={group.category} group={group} />)
      ) : (
        <Card>
          <Text className="text-sm text-gray-500">No evaluation criteria have been configured yet.</Text>
        </Card>
      )}
      <TextSection label="Strengths" value={evaluation.strengths} />
      <TextSection label="Areas for Improvement" value={evaluation.areas_for_improvement} />
      <TextSection label="Recommendations" value={evaluation.recommendations} />
      <TextSection label="Supervisor Remarks" value={evaluation.supervisor_remarks} />
    </>
  );
}

function HeaderSkeleton() {
  return (
    <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <SkeletonBlock className="h-6 w-2/3" />
      <SkeletonBlock className="h-4 w-1/2" />
      <SkeletonBlock className="h-4 w-1/2" />
      <SkeletonBlock className="h-9 w-full" />
    </View>
  );
}

function BodySkeleton() {
  return (
    <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-1/2" />
      <SkeletonBlock className="h-8 w-48" />
    </View>
  );
}

/** Route entry: /feedback/7 */
export function FeedbackDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const evaluationId = Number(id);
  if (!Number.isInteger(evaluationId) || evaluationId <= 0) return <Missing message={MESSAGES.notFound} />;
  return <FeedbackDetailView id={evaluationId} />;
}

function Missing({ message }: { message: string }) {
  const router = useRouter();
  return (
    <View className="flex-1 gap-3 bg-gray-50 p-4">
      <Stack.Screen options={{ title: 'Evaluation' }} />
      <Banner tone="warning" message={message} />
      <Button label="Back to My Feedback" variant="outline" onPress={() => router.back()} />
    </View>
  );
}

function FeedbackDetailView({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const query = useFeedback(id);
  const [pulling, setPulling] = useState(false);

  const evaluation = query.data;
  // While the detail loads, the list row already has what the header shows.
  const summary: FeedbackSummary | undefined = evaluation ?? feedbackFromList(queryClient, id);

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  if (!evaluation && query.isError) {
    const error = toApiError(query.error);
    if (error.kind === 'not_found') return <Missing message={NOT_FOUND} />;
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <Stack.Screen options={{ title: 'Evaluation' }} />
        <ErrorState message={error.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </View>
    );
  }

  const goneMeanwhile = query.isRefetchError && toApiError(query.error).kind === 'not_found';

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Evaluation' }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4 pb-8"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
        {goneMeanwhile ? (
          <Banner tone="warning" message={NOT_FOUND} />
        ) : query.isRefetchError ? (
          <Banner tone="warning" message={`Showing saved data. ${toApiError(query.error).message}`} />
        ) : null}

        {evaluation ? (
          <>
            <HeaderCard item={evaluation} />
            <Body evaluation={evaluation} />
          </>
        ) : (
          <>
            {summary ? <HeaderCard item={summary} /> : null}
            <SkeletonPulse label="Loading evaluation">
              <View className="gap-4">
                {summary ? null : <HeaderSkeleton />}
                <BodySkeleton />
              </View>
            </SkeletonPulse>
          </>
        )}
      </ScrollView>
    </View>
  );
}
