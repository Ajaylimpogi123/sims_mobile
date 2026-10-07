import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { toApiError } from '@/api/errors';
import { NO_REVIEW_FILTERS, reviewKeys, useReviewReports } from '@/api/reportReviews';
import type { ReviewReport, ReviewReportFilters } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchField } from '@/components/ui/SearchField';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { formatPeriod, KIND_LABEL, STATUS_LABEL, TYPE_LABEL } from '../reports/format';
import { ReportFilterChips } from '../reports/ReportParts';

import { takeReviewsFlash } from './flash';
import { reviewStudentMeta } from './format';
import { Text } from '@/components/ui/Text';

const HIGHLIGHT_MS = 3000;

/** Website subtitle (ReportReviews/Index.jsx). */
const SUBTITLE = 'Review student accomplishment reports and leave feedback';

// ---------------------------------------------------------------------------
// Card (website: Student, Type, Period, Status, Attachment, Review / View → one card)
// ---------------------------------------------------------------------------

function ReviewCard({ report, highlighted, showStudent, onOpen }: { report: ReviewReport; highlighted: boolean; showStudent: boolean; onOpen: () => void }) {
  const period = formatPeriod(report);
  const meta = reviewStudentMeta(report.student);
  const label = [
    showStudent ? report.student.name : null,
    `${TYPE_LABEL[report.type]} report, ${period}`,
    STATUS_LABEL[report.status],
    report.attachment ? 'has an attachment' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={report.can_review ? 'Opens the report to review it' : 'Opens the report'}
      className={`mx-4 mb-3 gap-2 rounded-2xl border p-4 ${highlighted ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white active:bg-gray-50'}`}>
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-0.5">
          {showStudent ? (
            <>
              <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                {report.student.name}
              </Text>
              <Text className="text-sm text-gray-600" numberOfLines={1}>
                {meta}
              </Text>
            </>
          ) : (
            <Text className="text-base font-semibold text-gray-900" style={TABULAR}>
              {period}
            </Text>
          )}
        </View>
        <StatusBadge status={report.status} />
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </View>
      <View className="flex-row flex-wrap items-center gap-1.5">
        {showStudent ? (
          <>
            <Text className="text-sm text-gray-700" style={TABULAR}>
              {period}
            </Text>
            <Text className="text-sm text-gray-400">·</Text>
          </>
        ) : null}
        <Text className="text-sm text-gray-600">{TYPE_LABEL[report.type]}</Text>
        {report.attachment ? (
          <>
            <Text className="text-sm text-gray-400">·</Text>
            <Ionicons name="attach" size={16} color={colors.gray500} />
            <Text className="text-sm text-gray-600">{KIND_LABEL[report.attachment.kind]}</Text>
          </>
        ) : null}
      </View>
      {report.reviewer_comment ? (
        <View className="mt-1 flex-row gap-2 rounded-lg bg-gray-50 px-3 py-2">
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.gray500} style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm leading-5 text-gray-700" numberOfLines={2}>
            {report.reviewer_comment}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <SkeletonPulse label="Loading reports">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="mx-4 mb-3 gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </View>
          <SkeletonBlock className="h-4 w-1/3" />
          <SkeletonBlock className="h-4 w-2/3" />
        </View>
      ))}
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

interface ReportReviewsListProps {
  /** Only this student's reports (students.id); hides the search and the student name on cards. */
  studentId?: number;
  /** Shown above everything (the supervisor's view switch). */
  top?: ReactNode;
}

/**
 * Report Reviews (website: ReportReviews/Index.jsx). Supervisor: own students, view only;
 * Coordinator / Admin: every report, review from the report screen. The API decides who sees what
 * and sends `can_review`. `?report_id=` (a notification) highlights that report, or opens it when it
 * isn't on the loaded pages.
 */
export function ReportReviewsList({ studentId, top }: ReportReviewsListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ report_id?: string }>();
  const [filters, setFilters] = useState<ReviewReportFilters>({ ...NO_REVIEW_FILTERS, studentId: studentId ?? null });
  const reports = useReviewReports(filters);
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const listRef = useRef<FlatList<ReviewReport>>(null);
  const lastOpen = useRef(0);

  const items = reports.data?.pages.flatMap((page) => page.data) ?? [];
  const forStudent = studentId !== undefined;

  useFocusEffect(
    useCallback(() => {
      const message = takeReviewsFlash();
      if (message) setFlash(message);
      void queryClient.refetchQueries({ queryKey: reviewKeys.lists, stale: true, type: 'active' });
    }, [queryClient]),
  );

  const open = useCallback(
    (id: number) => {
      // A quick double tap must not open the report twice.
      const now = Date.now();
      if (now - lastOpen.current < 1000) return;
      lastOpen.current = now;
      setFlash(null);
      router.push({ pathname: '/report-review/[id]', params: { id: String(id) } });
    },
    [router],
  );

  // A notification ("… submitted a report") lands here with ?report_id=12, once the list is loaded.
  const targetId = params.report_id;
  const handledTarget = useRef<string | null>(null);
  const loaded = !reports.isPending;
  useEffect(() => {
    if (!targetId) {
      handledTarget.current = null;
      return;
    }
    if (!loaded || handledTarget.current === targetId) return;
    handledTarget.current = targetId;
    router.setParams({ report_id: undefined });
    if (!/^\d+$/.test(targetId)) return;

    const id = Number(targetId);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
      // Not on the loaded pages (or filtered out): the report screen loads it by id.
      open(id);
      return;
    }
    setHighlightId(id);
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true }));
  }, [targetId, loaded, items, router, open]);

  useEffect(() => {
    if (highlightId === null) return;
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const refresh = async () => {
    setPulling(true);
    try {
      await reports.refetch();
    } finally {
      setPulling(false);
    }
  };

  const filtered = filters.status !== null || filters.type !== null || filters.search !== '';

  const header = (
    <View className="gap-3 pb-3 pt-4">
      {top ? <View className="px-4">{top}</View> : null}
      {!forStudent ? <Text className="px-4 text-sm text-gray-600">{SUBTITLE}</Text> : null}
      {flash ? (
        <View className="px-4">
          <Banner tone="success" message={flash} />
        </View>
      ) : null}
      {!forStudent ? (
        <View className="px-4">
          <SearchField placeholder="Search by student name or number..." maxLength={255} onSearch={(search) => setFilters((f) => ({ ...f, search }))} />
        </View>
      ) : null}
      <ReportFilterChips filters={filters} onChange={setFilters} />
      {reports.isRefetchError && items.length > 0 ? (
        <View className="px-4">
          <Banner tone="warning" message={`Showing saved data. ${toApiError(reports.error).message}`} />
        </View>
      ) : null}
    </View>
  );

  let empty: ReactElement;
  if (reports.isPending) empty = <ListSkeleton />;
  else if (reports.isError) {
    empty = (
      <View className="px-4">
        <ErrorState message={toApiError(reports.error).message} onRetry={() => void reports.refetch()} retrying={reports.isFetching} />
      </View>
    );
  } else if (filtered) {
    empty = <EmptyState icon="filter-outline" message="No reports match these filters." />;
  } else {
    // Website empty row text.
    empty = <EmptyState icon="document-text-outline" message="No reports to review." />;
  }

  return (
    <FlatList
      ref={listRef}
      className="flex-1 bg-gray-50"
      contentContainerClassName="pb-8"
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ReviewCard report={item} highlighted={item.id === highlightId} showStudent={!forStudent} onOpen={() => open(item.id)} />}
      extraData={highlightId}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={
        reports.isFetchingNextPage ? (
          <View className="py-6">
            <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more reports" />
          </View>
        ) : reports.isFetchNextPageError ? (
          <View className="items-center gap-2 px-4 py-6">
            <Text className="text-center text-sm text-gray-600">{toApiError(reports.error).message}</Text>
            <Button label="Try again" variant="outline" onPress={() => void reports.fetchNextPage()} />
          </View>
        ) : null
      }
      onEndReached={() => {
        if (reports.hasNextPage && !reports.isFetchingNextPage && !reports.isFetchNextPageError) void reports.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        listRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength - 80), animated: true });
      }}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={8}
      windowSize={7}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
    />
  );
}
