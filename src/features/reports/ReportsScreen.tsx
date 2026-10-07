import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { isNoStudentProfile } from '@/api/attendance';
import { toApiError } from '@/api/errors';
import { NO_REPORT_FILTERS, useReports } from '@/api/reports';
import type { Report, ReportFilters } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors } from '@/theme/colors';

import { takeReportsFlash } from './flash';
import { formatPeriod, KIND_LABEL, STATUS_LABEL, TYPE_LABEL } from './format';
import { ReportFilterChips } from './ReportParts';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Rows (website: one table row → one card)
// ---------------------------------------------------------------------------

function ReportRow({ report, onPress }: { report: Report; onPress: () => void }) {
  const period = formatPeriod(report);
  const label = [
    `${TYPE_LABEL[report.type]} report, ${period}`,
    STATUS_LABEL[report.status],
    report.attachment ? 'has an attachment' : null,
    report.reviewer_comment ? `Reviewer comment: ${report.reviewer_comment}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the report"
      className="mx-4 mb-3 rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50">
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-gray-900">{period}</Text>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-sm text-gray-600">{TYPE_LABEL[report.type]}</Text>
            {report.attachment ? (
              <>
                <Text className="text-sm text-gray-400">·</Text>
                <Ionicons name="attach" size={16} color={colors.gray500} />
                <Text className="text-sm text-gray-600">{KIND_LABEL[report.attachment.kind]}</Text>
              </>
            ) : null}
          </View>
        </View>
        <StatusBadge status={report.status} />
      </View>
      {report.reviewer_comment ? (
        <View className="mt-3 flex-row gap-2 rounded-lg bg-gray-50 px-3 py-2">
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
        <View key={i} className="mx-4 mb-3 gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </View>
          <SkeletonBlock className="h-4 w-1/4" />
        </View>
      ))}
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/** Student "My Reports" tab (website: InternshipReports/Index.jsx). `?report_id=` (from a notification) opens that report. */
export function ReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ report_id?: string }>();
  const [filters, setFilters] = useState<ReportFilters>(NO_REPORT_FILTERS);
  const reports = useReports(filters);
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const lastOpen = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const message = takeReportsFlash();
      if (message) setFlash(message);
    }, []),
  );

  const open = useCallback(
    (href: Parameters<typeof router.push>[0]) => {
      // A quick double tap must not open a screen twice.
      const now = Date.now();
      if (now - lastOpen.current < 1000) return;
      lastOpen.current = now;
      setFlash(null);
      router.push(href);
    },
    [router],
  );

  // A notification ("Your report was reviewed") lands here with ?report_id=12: open that report once.
  const handledReportId = useRef<string | null>(null);
  const targetId = params.report_id;
  useEffect(() => {
    if (!targetId) {
      // Cleared (below): the same notification may be tapped again later.
      handledReportId.current = null;
      return;
    }
    if (handledReportId.current === targetId) return;
    handledReportId.current = targetId;
    router.setParams({ report_id: undefined });
    if (/^\d+$/.test(targetId)) open({ pathname: '/report/[id]', params: { id: targetId } });
  }, [targetId, router, open]);

  const refresh = async () => {
    setPulling(true);
    try {
      await reports.refetch();
    } finally {
      setPulling(false);
    }
  };

  const noProfile = isNoStudentProfile(reports.error);
  const items = noProfile ? [] : (reports.data?.pages.flatMap((page) => page.data) ?? []);
  const filtered = filters.type !== null || filters.status !== null;

  const header = (
    <View className="gap-3 pb-3 pt-4">
      {flash || noProfile || reports.isRefetchError ? (
        <View className="gap-3 px-4">
          {flash ? <Banner tone="success" message={flash} /> : null}
          {noProfile ? <Banner tone="warning" message={toApiError(reports.error).message} /> : null}
          {!noProfile && reports.isRefetchError ? (
            <Banner tone="warning" message={`Showing saved data. ${toApiError(reports.error).message}`} />
          ) : null}
        </View>
      ) : null}
      {!noProfile ? <ReportFilterChips filters={filters} onChange={setFilters} /> : null}
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (!noProfile) {
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
      empty = <EmptyState icon="document-text-outline" message="No reports submitted yet." />;
    }
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        className="flex-1"
        contentContainerClassName="pb-28"
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ReportRow report={item} onPress={() => open({ pathname: '/report/[id]', params: { id: String(item.id) } })} />}
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
        initialNumToRender={8}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
      />

      {/* Thumb-zone primary action (website: the "New Report" button). */}
      {!noProfile ? (
        <Pressable
          onPress={() => open('/report-form')}
          accessibilityRole="button"
          accessibilityLabel="New Report"
          className="absolute bottom-5 right-4 h-14 flex-row items-center gap-2 rounded-xl bg-brand-700 px-5 active:bg-brand-800"
          style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
          <Ionicons name="add" size={22} color={colors.white} />
          <Text className="text-base font-semibold text-white">New Report</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
