import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { approvalKeys, useApprovals } from '@/api/approvals';
import { toApiError } from '@/api/errors';
import { ArchivedTermBanner } from '@/features/terms/TermSwitcher';
import type { ApprovalItem } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { formatDate, formatTime } from '@/lib/datetime';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { AttendancePhoto } from '../attendance/AttendancePhoto';

import { LegLabel, legLocation, MapLink, MockedLocationBadge } from './Evidence';
import { takeApprovalsFlash } from './flash';
import { LEG_SHORT, legLabel, rejectSubtitle, studentMeta } from './format';
import { LegActions } from './LegActions';
import { NoticeBar } from './NoticeBar';
import { RejectSheet } from './RejectSheet';
import { useApprovalActions, type ApprovalActions } from './useApprovalActions';
import { Text } from '@/components/ui/Text';

const HIGHLIGHT_MS = 3000;

// ---------------------------------------------------------------------------
// Card (website: one table row per pending leg → one card per record, a section per pending leg)
// ---------------------------------------------------------------------------

function PendingLeg({ item, leg, actions }: { item: ApprovalItem; leg: ApprovalItem['pending_legs'][number]; actions: ApprovalActions }) {
  const time = item[leg];
  const { mocked } = legLocation(item, leg);
  const note = leg === 'time_out' && item.note ? item.note : null;

  return (
    <View className="gap-3 border-t border-gray-100 pt-3">
      <View className="flex-row items-center gap-3">
        <AttendancePhoto url={item[`${leg}_photo_url`]} label={`${LEG_SHORT[leg]} photo, ${item.student.name}, ${formatDate(item.date)}`} />
        <View className="flex-1 gap-1" accessible accessibilityLabel={`${legLabel(item, leg)}, requested at ${time ? formatTime(time) : 'unknown time'}`}>
          <LegLabel item={item} leg={leg} />
          <Text className="text-base font-medium text-gray-900" style={TABULAR}>
            {time ? formatTime(time) : '-'}
          </Text>
        </View>
        <MapLink item={item} leg={leg} />
      </View>
      {mocked ? <MockedLocationBadge /> : null}
      {note ? (
        <Text className="text-sm leading-5 text-gray-700" numberOfLines={3}>
          <Text className="font-medium text-gray-900">Note: </Text>
          {note}
        </Text>
      ) : null}
      <LegActions item={item} leg={leg} actions={actions} />
    </View>
  );
}

function ApprovalCard({
  item,
  highlighted,
  actions,
  onOpen,
}: {
  item: ApprovalItem;
  highlighted: boolean;
  actions: ApprovalActions;
  onOpen: () => void;
}) {
  const meta = studentMeta(item);
  return (
    <View className={`mx-4 mb-3 gap-3 rounded-xl border p-4 ${highlighted ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${item.student.name}${meta ? `, ${meta}` : ''}, ${formatDate(item.date)}`}
        accessibilityHint="Opens the photo and location evidence"
        className="-m-2 flex-row items-center gap-2 rounded-lg p-2 active:bg-gray-50">
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {item.student.name}
          </Text>
          {meta ? (
            <Text className="text-sm text-gray-600" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Text className="text-sm text-gray-600" style={TABULAR}>
          {formatDate(item.date)}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </Pressable>
      {item.pending_legs.map((leg) => (
        <PendingLeg key={leg} item={item} leg={leg} actions={actions} />
      ))}
    </View>
  );
}

function ListSkeleton() {
  return (
    <SkeletonPulse label="Loading pending approvals">
      {[0, 1, 2].map((i) => (
        <View key={i} className="mx-4 mb-3 gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="h-4 w-20" />
          </View>
          <SkeletonBlock className="h-4 w-1/3" />
          <View className="flex-row items-center gap-3">
            <SkeletonBlock className="h-12 w-12 rounded-lg" />
            <SkeletonBlock className="h-4 flex-1" />
          </View>
          <View className="flex-row gap-3">
            <SkeletonBlock className="h-12 flex-1 rounded-md" />
            <SkeletonBlock className="h-12 flex-1 rounded-md" />
          </View>
        </View>
      ))}
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * "Pending Approvals" (website: AttendanceApprovals/Index.jsx) for Supervisors (own students) and
 * Administrators (all). `?attendance_id=` (a notification) highlights that record, or opens it when
 * it isn't on the loaded pages.
 */
export function ApprovalsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ attendance_id?: string }>();
  const approvals = useApprovals();
  const actions = useApprovalActions();
  const { showNotice } = actions;
  const [pulling, setPulling] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const listRef = useRef<FlatList<ApprovalItem>>(null);
  const lastOpen = useRef(0);

  const items = approvals.data?.pages.flatMap((page) => page.data) ?? [];

  useFocusEffect(
    useCallback(() => {
      const message = takeApprovalsFlash();
      if (message) showNotice({ tone: 'success', message });
      void queryClient.refetchQueries({ queryKey: approvalKeys.list, stale: true, type: 'active' });
      void queryClient.refetchQueries({ queryKey: approvalKeys.count, stale: true, type: 'active' });
    }, [queryClient, showNotice]),
  );

  const openDetail = useCallback(
    (id: number) => {
      // A quick double tap must not open the screen twice.
      const now = Date.now();
      if (now - lastOpen.current < 1000) return;
      lastOpen.current = now;
      router.push({ pathname: '/approval/[id]', params: { id: String(id) } });
    },
    [router],
  );

  // A notification ("… submitted a time-in") lands here with ?attendance_id=12, once the list is loaded.
  const targetId = params.attendance_id;
  const handledTarget = useRef<string | null>(null);
  const loaded = !approvals.isPending;
  useEffect(() => {
    if (!targetId) {
      handledTarget.current = null;
      return;
    }
    if (!loaded || handledTarget.current === targetId) return;
    handledTarget.current = targetId;
    router.setParams({ attendance_id: undefined });
    if (!/^\d+$/.test(targetId)) return;

    const id = Number(targetId);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      // Not on the loaded pages (or no longer pending): the evidence screen loads it by id.
      openDetail(id);
      return;
    }
    setHighlightId(id);
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true }));
  }, [targetId, loaded, items, router, openDetail]);

  useEffect(() => {
    if (highlightId === null) return;
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const refresh = async () => {
    setPulling(true);
    try {
      await Promise.all([approvals.refetch(), queryClient.refetchQueries({ queryKey: approvalKeys.count, type: 'active' })]);
    } finally {
      setPulling(false);
    }
  };

  const header = (
    <View className="gap-3 px-4 pb-3 pt-4">
      <ArchivedTermBanner />
      <Text className="text-sm text-gray-600">Review and approve or reject student time-in and time-out requests</Text>
      {approvals.isRefetchError && items.length > 0 ? (
        <Banner tone="warning" message={`Showing saved data. ${toApiError(approvals.error).message}`} />
      ) : null}
    </View>
  );

  let empty: React.ReactElement;
  if (approvals.isPending) empty = <ListSkeleton />;
  else if (approvals.isError) {
    empty = (
      <View className="px-4">
        <ErrorState message={toApiError(approvals.error).message} onRetry={() => void approvals.refetch()} retrying={approvals.isFetching} />
      </View>
    );
  } else {
    empty = <EmptyState icon="checkmark-done-circle-outline" message="No pending requests." />;
  }

  const rejecting = actions.rejecting;

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        ref={listRef}
        className="flex-1"
        contentContainerClassName="pb-28"
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ApprovalCard item={item} highlighted={item.id === highlightId} actions={actions} onOpen={() => openDetail(item.id)} />
        )}
        extraData={`${highlightId}-${actions.busy?.id ?? ''}-${actions.busy?.leg ?? ''}-${actions.busy?.decision ?? ''}`}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          approvals.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more requests" />
            </View>
          ) : approvals.isFetchNextPageError ? (
            <View className="items-center gap-2 px-4 py-6">
              <Text className="text-center text-sm text-gray-600">{toApiError(approvals.error).message}</Text>
              <Button label="Try again" variant="outline" onPress={() => void approvals.fetchNextPage()} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (approvals.hasNextPage && !approvals.isFetchingNextPage && !approvals.isFetchNextPageError) void approvals.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          // Not measured yet: jump near it, then the highlight is visible on the way.
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength - 80), animated: true });
        }}
        initialNumToRender={6}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
      />

      <NoticeBar
        notice={actions.notice}
        onDismiss={actions.dismissNotice}
      />

      <RejectSheet
        visible={rejecting !== null}
        title={rejecting ? `Reject ${legLabel(rejecting.item, rejecting.leg)}` : ''}
        subtitle={rejecting ? rejectSubtitle(rejecting.item, rejecting.leg) : ''}
        submitting={actions.busy?.decision === 'reject'}
        fieldError={actions.sheetFieldError}
        error={actions.sheetError}
        onSubmit={actions.submitReject}
        onClose={actions.closeReject}
      />
    </View>
  );
}
