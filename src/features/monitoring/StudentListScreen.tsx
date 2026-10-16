import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { toApiError } from '@/api/errors';
import { ArchivedTermBanner } from '@/features/terms/TermSwitcher';
import { useMonitoringList } from '@/api/monitoring';
import type { MonitoredStudent } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchField } from '@/components/ui/SearchField';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatNumber, TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { NoticeBar } from '../approvals/NoticeBar';
import type { Notice } from '../approvals/useApprovalActions';
import { HoursProgressBar, REQUIRED_HOURS_NOT_SET } from '../dashboard/HoursProgressBar';

import { hoursColumns, internshipStatus, studentMeta } from './format';
import { RequiredHoursSheet } from './RequiredHoursSheet';
import { Text } from '@/components/ui/Text';

export type MonitoringKind = 'attendance' | 'progress';

/** Website page subtitles (AttendanceMonitoring/Index.jsx, ProgressMonitoring/Index.jsx). */
const SUBTITLE: Record<MonitoringKind, string> = {
  attendance: 'Track rendered vs. required internship hours, and manage daily attendance records',
  progress: "Track each student's internship status and hours progress",
};

// ---------------------------------------------------------------------------
// Cards (website: one table row per student → one card)
// ---------------------------------------------------------------------------

/** Attendance Monitoring row: Name, Company, Rendered / Required / Remaining Hours (+ status and bar). */
function AttendanceBody({ student, onSetHours }: { student: MonitoredStudent; onSetHours?: () => void }) {
  return (
    <>
      <View className="flex-row gap-2">
        {hoursColumns(student).map((column) => (
          <View key={column.label} className="flex-1 gap-0.5">
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {column.label}
            </Text>
            <Text className="text-sm font-medium text-gray-900" style={TABULAR} numberOfLines={1}>
              {column.value}
            </Text>
          </View>
        ))}
      </View>
      <HoursProgressBar
        rendered={student.rendered_hours}
        required={student.required_hours}
        percent={student.progress_percent}
        hideCaption
        onSetRequired={onSetHours}
      />
    </>
  );
}

/**
 * Progress Monitoring row: Name, Company, Status, Progress ("120/486 hrs (25%)" or "Required hours not set",
 * text only like the website's page, which has no Required Hours action), Remaining Hours.
 */
function ProgressBody({ student }: { student: MonitoredStudent }) {
  return (
    <>
      <HoursProgressBar rendered={student.rendered_hours} required={student.required_hours} percent={student.progress_percent} />
      <Text className="text-sm text-gray-600" style={TABULAR}>
        Remaining Hours:{' '}
        <Text className="font-medium text-gray-900">{student.remaining_hours !== null ? formatNumber(student.remaining_hours) : '—'}</Text>
      </Text>
    </>
  );
}

interface StudentCardProps {
  student: MonitoredStudent;
  kind: MonitoringKind;
  onOpen: () => void;
  onSetHours: () => void;
}

function StudentCard({ student, kind, onOpen, onSetHours }: StudentCardProps) {
  const meta = studentMeta(student);
  // Website (Attendance Monitoring only): a "Set" link next to "Required hours not set", for roles that may edit them.
  const canSet = kind === 'attendance' && student.required_hours === null && student.can_edit_required_hours;
  const setHours = canSet ? onSetHours : undefined;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${student.name}, ${meta}${student.required_hours === null ? `, ${REQUIRED_HOURS_NOT_SET}` : ''}`}
      accessibilityHint="Opens the attendance log"
      // The card is one screen-reader stop, so its inner "Set" link is also offered as an action.
      accessibilityActions={canSet ? [{ name: 'setRequiredHours', label: 'Set Required Hours' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'setRequiredHours') onSetHours();
      }}
      className="mx-4 mb-3 gap-3 rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50">
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {student.name}
          </Text>
          <Text className="text-sm text-gray-600" numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <StatusBadge status={internshipStatus(student)} />
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </View>
      {kind === 'attendance' ? <AttendanceBody student={student} onSetHours={setHours} /> : <ProgressBody student={student} />}
    </Pressable>
  );
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <SkeletonPulse label={label}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="mx-4 mb-3 gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </View>
          <SkeletonBlock className="h-4 w-1/3" />
          <SkeletonBlock className="h-2 w-full rounded-full" />
        </View>
      ))}
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

interface StudentListProps {
  kind: MonitoringKind;
  /** Shown above the search field (the supervisor's Attendance / Progress switch). */
  top?: ReactNode;
}

/**
 * Attendance Monitoring / Progress Monitoring student list (website: the two DataTables), with the
 * website's name filter. Tap a student for their attendance log. `?student_id=` opens that student.
 * What each role sees is decided by the API (Supervisor: own students; Coordinator, Admin: all).
 */
export function StudentList({ kind, top }: StudentListProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ student_id?: string }>();
  const [search, setSearch] = useState('');
  const query = useMonitoringList(kind === 'attendance' ? 'students' : 'progress', search);
  const [pulling, setPulling] = useState(false);
  const lastOpen = useRef(0);
  const [hoursStudent, setHoursStudent] = useState<MonitoredStudent | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages[0]?.meta.total;

  const open = useCallback(
    (id: number) => {
      const now = Date.now();
      if (now - lastOpen.current < 1000) return;
      lastOpen.current = now;
      router.push({ pathname: '/monitoring/[id]', params: { id: String(id) } });
    },
    [router],
  );

  // A link with ?student_id= opens that student's log once.
  const targetId = params.student_id;
  useEffect(() => {
    if (!targetId) return;
    router.setParams({ student_id: undefined });
    if (/^\d+$/.test(targetId)) open(Number(targetId));
  }, [targetId, router, open]);

  // Back from a student's log (after edits) or another tab: refresh if the data is old.
  const queryClient = useQueryClient();
  const listKey = kind === 'attendance' ? 'students' : 'progress';
  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({ queryKey: ['monitoring', listKey], stale: true, type: 'active' });
    }, [queryClient, listKey]),
  );

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  const header = (
    <View className="gap-3 px-4 pb-3 pt-4">
      {top ?? <ArchivedTermBanner />}
      <Text className="text-sm text-gray-600">{SUBTITLE[kind]}</Text>
      <SearchField placeholder="Filter by student name..." onSearch={setSearch} />
      {query.isRefetchError && items.length > 0 ? (
        <Banner tone="warning" message={`Showing saved data. ${toApiError(query.error).message}`} />
      ) : null}
      {total !== undefined && items.length > 0 ? (
        <Text className="text-xs text-gray-500" style={TABULAR}>
          {formatNumber(total)} student{total === 1 ? '' : 's'}
        </Text>
      ) : null}
    </View>
  );

  let empty: ReactElement;
  if (query.isPending) empty = <ListSkeleton label={kind === 'attendance' ? 'Loading students' : 'Loading progress'} />;
  else if (query.isError) {
    empty = (
      <View className="px-4">
        <ErrorState message={toApiError(query.error).message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </View>
    );
  } else {
    empty = <EmptyState icon="people-outline" message="No results." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        className="flex-1"
        contentContainerClassName="pb-8"
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <StudentCard
            student={item}
            kind={kind}
            onOpen={() => open(item.id)}
            onSetHours={() => {
              setNotice(null);
              setHoursStudent(item);
            }}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more students" />
            </View>
          ) : query.isFetchNextPageError ? (
            <View className="items-center gap-2 px-4 py-6">
              <Text className="text-center text-sm text-gray-600">{toApiError(query.error).message}</Text>
              <Button label="Try again" variant="outline" onPress={() => void query.fetchNextPage()} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
      />

      <NoticeBar notice={notice} onDismiss={dismissNotice} />

      <RequiredHoursSheet
        student={hoursStudent}
        onClose={() => setHoursStudent(null)}
        onSaved={(message) => {
          setHoursStudent(null);
          setNotice({ tone: 'success', message });
        }}
      />
    </View>
  );
}
