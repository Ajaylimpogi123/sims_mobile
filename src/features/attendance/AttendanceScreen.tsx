import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { attendanceKeys, isNoStudentProfile, useAttendanceHistory, useAttendanceToday } from '@/api/attendance';
import { toApiError } from '@/api/errors';
import type { AttendanceAction, AttendanceLeg, AttendanceRecord, AttendanceToday } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate, formatLongDate, formatTime } from '@/lib/datetime';
import { formatNumber, TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { AttendancePhoto } from './AttendancePhoto';
import { takeAttendanceFlash } from './flash';
import { openInMaps } from './photo';

const LEG_LABEL: Record<AttendanceLeg, string> = { time_in: 'Time In', time_out: 'Time Out' };

// ---------------------------------------------------------------------------
// Hours + Today (website: the three stat cards and the "Today —" card)
// ---------------------------------------------------------------------------

function HoursSummary({ hours }: { hours: AttendanceToday['hours'] }) {
  const items = [
    { label: 'Hours Rendered', value: formatNumber(hours.rendered) },
    { label: 'Required Hours', value: hours.required !== null ? formatNumber(hours.required) : 'Not set' },
    { label: 'Remaining Hours', value: hours.remaining !== null ? formatNumber(hours.remaining) : '—' },
  ];
  return (
    <Card>
      <View className="flex-row">
        {items.map((item, index) => (
          <View
            key={item.label}
            className={`flex-1 gap-1 ${index > 0 ? 'border-l border-gray-100 pl-3' : ''}`}
            accessible
            accessibilityLabel={`${item.label}: ${item.value}`}>
            <Text className="text-xs text-gray-500">{item.label}</Text>
            <Text className="text-xl font-semibold text-gray-900" style={TABULAR}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function TodayLeg({ record, leg }: { record: AttendanceRecord | null; leg: AttendanceLeg }) {
  const time = record?.[leg] ?? null;
  const status = record?.[`${leg}_status`] ?? null;
  return (
    <View
      className="min-h-10 flex-row items-center gap-3"
      accessible
      accessibilityLabel={`${LEG_LABEL[leg]}: ${time ? formatTime(time) : 'Not recorded'}${status ? `, ${status}` : ''}`}>
      <Text className="w-20 text-sm text-gray-600">{LEG_LABEL[leg]}</Text>
      <Text className={`flex-1 text-base ${time ? 'font-medium text-gray-900' : 'text-gray-500'}`} style={TABULAR}>
        {time ? formatTime(time) : 'Not recorded'}
      </Text>
      {status ? <StatusBadge status={status} /> : null}
    </View>
  );
}

function TodayCard({ today, onAction }: { today: AttendanceToday; onAction: (action: AttendanceAction) => void }) {
  const { record, actions } = today;
  // Only what the server allows; otherwise the server's reason for the next step (time out once time-in is used).
  const blockedReason = !actions.time_in.allowed && !actions.time_out.allowed ? actions.time_out.reason : null;

  return (
    <Card title={`Today — ${formatLongDate(today.date)}`}>
      <TodayLeg record={record} leg="time_in" />
      <View className="h-px bg-gray-100" />
      <TodayLeg record={record} leg="time_out" />

      {record?.time_in_status === 'rejected' && record.time_in_rejection_reason ? (
        <Text className="mt-2 text-sm text-red-600">Time-in rejected: {record.time_in_rejection_reason}</Text>
      ) : null}
      {record?.time_out_status === 'rejected' && record.time_out_rejection_reason ? (
        <Text className="mt-2 text-sm text-red-600">Time-out rejected: {record.time_out_rejection_reason}</Text>
      ) : null}

      <View className="mt-4 gap-3">
        {actions.time_in.allowed ? (
          <Button label="Time In" icon="log-in-outline" onPress={() => onAction('time_in')} />
        ) : null}
        {actions.time_out.allowed ? (
          <Button label="Time Out" icon="log-out-outline" onPress={() => onAction('time_out')} />
        ) : null}
        {blockedReason ? <Banner tone="info" message={blockedReason} /> : null}
        <Text className="text-xs text-gray-500">
          Time in and time out require a live photo from your camera and your current location.
        </Text>
      </View>

      {actions.emergency_time_out.allowed ? (
        <View className="mt-3 border-t border-gray-100 pt-2">
          <Pressable
            onPress={() => onAction('emergency_time_out')}
            accessibilityRole="button"
            className="min-h-11 flex-row items-center gap-2 rounded-lg active:bg-red-50">
            <Ionicons name="warning-outline" size={18} color={colors.red600} />
            <Text className="flex-1 text-sm font-medium text-red-600">
              Report Emergency (time out without an approved time-in)
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// History rows (website: the attendance table, one card per day)
// ---------------------------------------------------------------------------

function HistoryLeg({ record, leg }: { record: AttendanceRecord; leg: AttendanceLeg }) {
  const time = record[leg];
  const status = record[`${leg}_status`];
  const latitude = record[`${leg}_latitude`];
  const longitude = record[`${leg}_longitude`];
  const accuracy = record[`${leg}_accuracy`];
  const hasLocation = latitude !== null && longitude !== null;

  return (
    <View className="flex-row items-center gap-3 py-2">
      {time ? (
        <AttendancePhoto url={record[`${leg}_photo_url`]} label={`${LEG_LABEL[leg]} photo, ${formatDate(record.date)}`} />
      ) : (
        <View className="h-12 w-12" />
      )}
      <View className="flex-1 gap-0.5">
        <Text className="text-xs text-gray-500">{LEG_LABEL[leg]}</Text>
        <Text className={`text-base ${time ? 'font-medium text-gray-900' : 'text-gray-500'}`} style={TABULAR}>
          {time ? formatTime(time) : '-'}
        </Text>
      </View>
      {hasLocation ? (
        <Pressable
          onPress={() => openInMaps(latitude, longitude)}
          accessibilityRole="link"
          accessibilityLabel={`View ${LEG_LABEL[leg]} location on the map${accuracy !== null ? `, accurate to ${Math.round(accuracy)} metres` : ''}`}
          className="min-h-11 items-end justify-center rounded-lg px-1 active:bg-brand-50">
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={14} color={colors.brand700} />
            <Text className="text-sm font-medium text-brand-700 underline">View map</Text>
          </View>
          {accuracy !== null ? (
            <Text className="text-xs text-gray-500" style={TABULAR}>
              ±{Math.round(accuracy)} m
            </Text>
          ) : null}
        </Pressable>
      ) : time ? (
        <Text className="text-xs text-gray-500">No location</Text>
      ) : null}
      <View className="w-20 items-end">{status ? <StatusBadge status={status} /> : null}</View>
    </View>
  );
}

function HistoryCard({ record }: { record: AttendanceRecord }) {
  return (
    <Card className="mx-4 mb-3">
      <View className="mb-1 flex-row items-center gap-2">
        <Text className="flex-1 text-base font-semibold text-gray-900">{formatDate(record.date)}</Text>
        {record.is_emergency ? (
          <View className="rounded-full bg-red-100 px-2 py-0.5">
            <Text className="text-xs font-medium text-red-700">Emergency</Text>
          </View>
        ) : null}
        <Text className="text-sm text-gray-600" style={TABULAR}>
          {record.rendered_hours !== null ? `${formatNumber(record.rendered_hours)} hrs` : '-'}
        </Text>
      </View>
      <HistoryLeg record={record} leg="time_in" />
      <View className="h-px bg-gray-100" />
      <HistoryLeg record={record} leg="time_out" />
      {record.time_in_status === 'rejected' && record.time_in_rejection_reason ? (
        <Text className="mt-1 text-sm text-red-600">Time-in rejected: {record.time_in_rejection_reason}</Text>
      ) : null}
      {record.time_out_status === 'rejected' && record.time_out_rejection_reason ? (
        <Text className="mt-1 text-sm text-red-600">Time-out rejected: {record.time_out_rejection_reason}</Text>
      ) : null}
      {record.is_emergency && record.note ? (
        <Text className="mt-1 text-sm text-gray-600" numberOfLines={4}>
          Emergency: {record.note}
        </Text>
      ) : null}
    </Card>
  );
}

function HistorySkeleton() {
  return (
    <SkeletonPulse label="Loading attendance history">
      {[0, 1, 2].map((i) => (
        <View key={i} className="mx-4 mb-3 gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-4 w-1/3" />
          <View className="flex-row items-center gap-3">
            <SkeletonBlock className="h-12 w-12 rounded-lg" />
            <SkeletonBlock className="h-4 flex-1" />
          </View>
          <View className="flex-row items-center gap-3">
            <SkeletonBlock className="h-12 w-12 rounded-lg" />
            <SkeletonBlock className="h-4 flex-1" />
          </View>
        </View>
      ))}
    </SkeletonPulse>
  );
}

function TodaySkeleton() {
  return (
    <SkeletonPulse label="Loading today's attendance">
      <View className="gap-4">
        <SkeletonBlock className="h-20 w-full rounded-2xl" />
        <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-5 w-2/3" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
        </View>
      </View>
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/** Student "My Attendance" tab (website: Attendance/Index.jsx). */
export function AttendanceScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = useAttendanceToday();
  const history = useAttendanceHistory();
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const lastOpen = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setFlash(takeAttendanceFlash());
      void queryClient.refetchQueries({ queryKey: attendanceKeys.all, stale: true, type: 'active' });
    }, [queryClient]),
  );

  const openCapture = (action: AttendanceAction) => {
    // A quick double tap must not open the capture screen twice.
    const now = Date.now();
    if (now - lastOpen.current < 1000) return;
    lastOpen.current = now;
    setFlash(null);
    router.push({ pathname: '/attendance-capture', params: { action } });
  };

  const refresh = async () => {
    setPulling(true);
    try {
      await Promise.all([today.refetch(), history.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  const noProfile = isNoStudentProfile(today.error) || isNoStudentProfile(history.error);
  const items = noProfile ? [] : (history.data?.pages.flatMap((page) => page.data) ?? []);

  const header = (
    <View className="gap-4 p-4">
      {flash ? <Banner tone="success" message={flash} /> : null}
      {noProfile ? (
        <Banner tone="warning" message={toApiError(today.error ?? history.error).message} />
      ) : today.data ? (
        <>
          {today.isRefetchError ? (
            <Banner tone="warning" message={`Showing saved data. ${toApiError(today.error).message}`} />
          ) : null}
          <HoursSummary hours={today.data.hours} />
          <TodayCard today={today.data} onAction={openCapture} />
        </>
      ) : today.isPending ? (
        <TodaySkeleton />
      ) : (
        <ErrorState message={toApiError(today.error).message} onRetry={() => void today.refetch()} retrying={today.isFetching} />
      )}
      {!noProfile ? (
        <Text accessibilityRole="header" className="mt-2 text-base font-semibold text-gray-900">
          Attendance History
        </Text>
      ) : null}
    </View>
  );

  let empty: React.ReactElement | null = null;
  if (!noProfile) {
    if (history.isPending) empty = <HistorySkeleton />;
    else if (history.isError) {
      empty = (
        <View className="px-4">
          <ErrorState message={toApiError(history.error).message} onRetry={() => void history.refetch()} retrying={history.isFetching} />
        </View>
      );
    } else empty = <EmptyState icon="calendar-outline" message="No attendance records yet." />;
  }

  return (
    <FlatList
      className="flex-1 bg-gray-50"
      contentContainerClassName="pb-10"
      data={items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <HistoryCard record={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={
        history.isFetchingNextPage ? (
          <View className="py-6">
            <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more attendance" />
          </View>
        ) : history.isFetchNextPageError ? (
          <View className="items-center gap-2 px-4 py-6">
            <Text className="text-center text-sm text-gray-600">{toApiError(history.error).message}</Text>
            <Button label="Try again" variant="outline" onPress={() => void history.fetchNextPage()} />
          </View>
        ) : null
      }
      onEndReached={() => {
        if (history.hasNextPage && !history.isFetchingNextPage && !history.isFetchNextPageError) void history.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      initialNumToRender={6}
      windowSize={7}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
    />
  );
}
