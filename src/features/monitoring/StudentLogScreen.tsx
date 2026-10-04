import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/errors';
import { monitoringKeys, useAttendanceLog, useDeleteEntry, useMonitoredStudent } from '@/api/monitoring';
import type { MonitoredStudent, MonitoringAttendance } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatLongDate } from '@/lib/datetime';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { NoticeBar } from '../approvals/NoticeBar';
import type { Notice } from '../approvals/useApprovalActions';
import { AttendanceDayCard } from '../attendance/AttendanceDayCard';
import { HoursProgressBar } from '../dashboard/HoursProgressBar';

import { takeMonitoringFlash } from './flash';
import { hoursColumns, internshipStatus, studentMeta } from './format';
import { RequiredHoursSheet } from './RequiredHoursSheet';

const HIGHLIGHT_MS = 3000;
const GONE_MESSAGE = 'This attendance entry is no longer available. The log has been refreshed.';

// ---------------------------------------------------------------------------
// Student header: who, hours, progress, Set Required Hours
// ---------------------------------------------------------------------------

function StudentSummary({ student, onSetHours }: { student: MonitoredStudent; onSetHours: () => void }) {
  return (
    <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-0.5">
          <Text accessibilityRole="header" className="text-base font-semibold text-gray-900">
            {student.name}
          </Text>
          <Text className="text-sm text-gray-600">{studentMeta(student)}</Text>
          {student.supervisor ? <Text className="text-sm text-gray-600">Supervisor: {student.supervisor.name}</Text> : null}
        </View>
        <StatusBadge status={internshipStatus(student)} />
      </View>
      <View className="flex-row gap-2">
        {hoursColumns(student).map((column) => (
          <View key={column.label} className="flex-1 gap-0.5">
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {column.label}
            </Text>
            <Text className="text-base font-semibold text-gray-900" style={TABULAR} numberOfLines={1}>
              {column.value}
            </Text>
          </View>
        ))}
      </View>
      <HoursProgressBar rendered={student.rendered_hours} required={student.required_hours} percent={student.progress_percent} />
      {student.can_edit_required_hours ? (
        <Button label="Set Required Hours" variant="outline" icon="hourglass-outline" onPress={onSetHours} />
      ) : null}
    </View>
  );
}

function SummarySkeleton() {
  return (
    <SkeletonPulse label="Loading student">
      <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <SkeletonBlock className="h-5 w-1/2" />
        <SkeletonBlock className="h-4 w-1/3" />
        <SkeletonBlock className="h-10 w-full" />
        <SkeletonBlock className="h-2 w-full rounded-full" />
      </View>
    </SkeletonPulse>
  );
}

function LogSkeleton() {
  return (
    <SkeletonPulse label="Loading attendance log">
      {[0, 1].map((i) => (
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

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * One student's Attendance Log (website: AttendanceMonitoring LogModal): hours, the day-by-day
 * records with photo / location evidence (and the fake-GPS warning), and, only when the API's flags
 * allow (the student's Supervisor, an Admin; never a Coordinator): Add Entry, Edit, Delete, Set
 * Required Hours. `?attendance_id=` highlights a record.
 */
export function StudentLogScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; attendance_id?: string }>();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;

  const studentQuery = useMonitoredStudent(id);
  const log = useAttendanceLog(id);
  const deleteEntry = useDeleteEntry();
  const student = studentQuery.data ?? null;
  const records = log.data?.pages.flatMap((page) => page.data) ?? [];

  const [notice, setNotice] = useState<Notice | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const busy = useRef(false);
  const listRef = useRef<FlatList<MonitoringAttendance>>(null);
  const lastOpen = useRef(0);

  const dismissNotice = useCallback(() => setNotice(null), []);

  useFocusEffect(
    useCallback(() => {
      const message = takeMonitoringFlash();
      if (message) setNotice({ tone: 'success', message });
      if (id !== null) {
        void queryClient.refetchQueries({ queryKey: monitoringKeys.student(id), stale: true, type: 'active' });
        void queryClient.refetchQueries({ queryKey: monitoringKeys.log(id), stale: true, type: 'active' });
      }
    }, [id, queryClient]),
  );

  // ?attendance_id= (a link): highlight that record once the log has loaded.
  const targetId = params.attendance_id;
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!targetId || log.isPending || handled.current === targetId) return;
    handled.current = targetId;
    router.setParams({ attendance_id: undefined });
    const index = records.findIndex((record) => String(record.id) === targetId);
    if (index < 0) return;
    setHighlightId(records[index].id);
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.2, animated: true }));
  }, [targetId, log.isPending, records, router]);

  useEffect(() => {
    if (highlightId === null) return;
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const openForm = (attendanceId?: number) => {
    if (id === null || busy.current) return;
    const now = Date.now();
    if (now - lastOpen.current < 1000) return;
    lastOpen.current = now;
    router.push({
      pathname: '/monitoring-entry',
      params: attendanceId ? { student_id: String(id), attendance_id: String(attendanceId) } : { student_id: String(id) },
    });
  };

  const confirmDelete = (record: MonitoringAttendance) => {
    if (busy.current) return;
    // Website wording (LogModal.jsx).
    Alert.alert('Delete entry', `Delete the attendance entry for ${formatLongDate(record.date)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void runDelete(record) },
    ]);
  };

  const runDelete = async (record: MonitoringAttendance) => {
    if (busy.current) return;
    busy.current = true;
    setDeletingId(record.id);
    setNotice(null);
    try {
      const response = await deleteEntry.mutateAsync(record.id);
      setNotice({ tone: 'success', message: response.message });
    } catch (error) {
      const apiError = toApiError(error);
      setNotice({ tone: 'error', message: apiError.kind === 'not_found' ? GONE_MESSAGE : apiError.message });
    } finally {
      busy.current = false;
      setDeletingId(null);
    }
  };

  const refresh = async () => {
    setPulling(true);
    try {
      await Promise.all([studentQuery.refetch(), log.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  // The student itself failed (404: not this supervisor's student, or gone).
  if (id === null || (studentQuery.isError && !student)) {
    const error = id === null ? null : toApiError(studentQuery.error);
    return (
      <View className="flex-1 bg-gray-50 p-4">
        {error && error.kind !== 'not_found' ? (
          <ErrorState message={error.message} onRetry={() => void studentQuery.refetch()} retrying={studentQuery.isFetching} />
        ) : (
          <EmptyState icon="person-outline" message="We couldn't find that student. They may have been removed or reassigned." />
        )}
      </View>
    );
  }

  const canWrite = student?.can_edit_attendance === true;

  const header = (
    <View className="gap-4 px-4 pb-3 pt-4">
      {student ? <StudentSummary student={student} onSetHours={() => setHoursOpen(true)} /> : <SummarySkeleton />}
      {studentQuery.isRefetchError || log.isRefetchError ? (
        <Banner tone="warning" message={`Showing saved data. ${toApiError(studentQuery.error ?? log.error).message}`} />
      ) : null}
      <View className="gap-0.5">
        <Text accessibilityRole="header" className="text-base font-semibold text-gray-900">
          Attendance Log
        </Text>
        {student ? (
          <Text className="text-sm text-gray-500">
            {canWrite ? 'Add a missed entry or correct an existing one' : "Read-only view of this student's attendance records"}
          </Text>
        ) : null}
      </View>
    </View>
  );

  let empty: ReactElement;
  if (log.isPending) empty = <LogSkeleton />;
  else if (log.isError) {
    empty = (
      <View className="px-4">
        <ErrorState message={toApiError(log.error).message} onRetry={() => void log.refetch()} retrying={log.isFetching} />
      </View>
    );
  } else {
    empty = <EmptyState icon="calendar-outline" message="No attendance records yet." />;
  }

  const renderRecord = ({ item }: { item: MonitoringAttendance }) => {
    const deleting = deletingId === item.id;
    const showActions = item.can_edit || item.can_delete;
    return (
      <AttendanceDayCard
        record={item}
        showMocked
        highlighted={item.id === highlightId}
        meta={`Recorded by ${item.recorded_by === 'self' ? 'Self' : 'Staff'}`}>
        {showActions ? (
          <View className="mt-3 flex-row gap-3 border-t border-gray-100 pt-3">
            {item.can_edit ? (
              <Button
                label="Edit"
                variant="outline"
                icon="create-outline"
                onPress={() => openForm(item.id)}
                disabled={deletingId !== null}
                className="flex-1"
                accessibilityHint={`Edits the entry for ${formatLongDate(item.date)}`}
              />
            ) : null}
            {item.can_delete ? (
              <Button
                label="Delete"
                variant="danger"
                icon="trash-outline"
                onPress={() => confirmDelete(item)}
                loading={deleting}
                loadingLabel="Deleting…"
                disabled={deletingId !== null && !deleting}
                className="flex-1"
                accessibilityHint={`Deletes the entry for ${formatLongDate(item.date)}`}
              />
            ) : null}
          </View>
        ) : null}
      </AttendanceDayCard>
    );
  };

  const bottomBar = canWrite ? 80 + insets.bottom : 0;

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        ref={listRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: bottomBar + 24 }}
        data={records}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRecord}
        extraData={`${highlightId}-${deletingId}-${canWrite}`}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          log.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more attendance" />
            </View>
          ) : log.isFetchNextPageError ? (
            <View className="items-center gap-2 px-4 py-6">
              <Text className="text-center text-sm text-gray-600">{toApiError(log.error).message}</Text>
              <Button label="Try again" variant="outline" onPress={() => void log.fetchNextPage()} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (log.hasNextPage && !log.isFetchingNextPage && !log.isFetchNextPageError) void log.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength), animated: true });
        }}
        initialNumToRender={5}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
      />

      {canWrite ? (
        <View className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Button label="Add Entry" icon="add" onPress={() => openForm()} disabled={deletingId !== null} />
        </View>
      ) : null}

      <NoticeBar notice={notice} onDismiss={dismissNotice} bottom={bottomBar + 16} />

      <RequiredHoursSheet
        student={hoursOpen ? student : null}
        onClose={() => setHoursOpen(false)}
        onSaved={(message) => {
          setHoursOpen(false);
          setNotice({ tone: 'success', message });
        }}
      />
    </View>
  );
}
