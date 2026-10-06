import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { ASSIGNMENT_SEARCH_MAX, assignmentKeys, NO_ASSIGNMENT_FILTERS, useAssignmentOptions, useAssignments } from '@/api/assignments';
import { toApiError } from '@/api/errors';
import type { AssignmentFilters, AssignmentStudent, InternshipStatus } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChip } from '@/components/ui/FilterChip';
import { SearchField } from '@/components/ui/SearchField';
import { SelectSheet } from '@/components/ui/SelectSheet';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { takeAssignmentsFlash } from './flash';

/** Website subtitle (InternshipAssignment/Index.jsx). */
const SUBTITLE = "View and manage every student's profile, company/supervisor assignment, and internship status in one place";

/** The website's internship statuses (Columns.jsx STATUS_LABELS). */
export const INTERNSHIP_STATUSES: { value: InternshipStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
];

/** Company filter: 0 in the picker stands for the API's "none" (no company). */
const UNASSIGNED_OPTION = 0;

// ---------------------------------------------------------------------------
// Card (website row: Name, Student Number, Company, Supervisor, Internship Status, Account Status)
// ---------------------------------------------------------------------------

function Line({ icon, text, muted }: { icon: keyof typeof Ionicons.glyphMap; text: string; muted: boolean }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={14} color={colors.gray500} />
      <Text className={`flex-1 text-sm ${muted ? 'text-gray-500' : 'text-gray-700'}`} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function StudentCard({ item, onOpen }: { item: AssignmentStudent; onOpen: () => void }) {
  const status = INTERNSHIP_STATUSES.find((s) => s.value === item.internship_status)?.label ?? 'Not Started';
  const company = item.company?.company_name ?? 'Unassigned';
  const supervisor = item.supervisor?.name ?? 'Unassigned';
  const label = [
    item.name ?? item.student_number,
    item.student_number,
    `Company ${company}`,
    `Supervisor ${supervisor}`,
    `Internship status ${status}`,
    item.status === 'inactive' ? 'Account inactive' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the student"
      className="mx-4 mb-3 gap-1.5 rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-base font-semibold text-gray-900" numberOfLines={1}>
          {item.name ?? item.student_number}
        </Text>
        <StatusBadge status={item.internship_status} />
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-xs text-gray-500" style={TABULAR} numberOfLines={1}>
          {[item.student_number, [item.course, item.section].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
        </Text>
        {item.status === 'inactive' ? <StatusBadge status="inactive" /> : null}
      </View>
      <View className="mt-1 gap-1">
        <Line icon="business-outline" text={company} muted={!item.company} />
        <Line icon="person-outline" text={supervisor} muted={!item.supervisor} />
      </View>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <SkeletonPulse label="Loading students">
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} className="mx-4 mb-3 gap-2 rounded-2xl border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="h-5 w-20 rounded-full" />
          </View>
          <SkeletonBlock className="h-3 w-1/3" />
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-4 w-1/2" />
        </View>
      ))}
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Internship Assignment (website: InternshipAssignment/Index.jsx), Coordinator + Admin. Tap a
 * student for their profile and assignment, Edit and Activate / Deactivate.
 */
export function AssignmentsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AssignmentFilters>(NO_ASSIGNMENT_FILTERS);
  const students = useAssignments(filters);
  const [companyPicker, setCompanyPicker] = useState(false);
  const options = useAssignmentOptions();
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const lastOpen = useRef(0);

  const pages = students.data?.pages ?? [];
  const items = pages.flatMap((page) => page.data);
  const total = pages[pages.length - 1]?.meta.total ?? 0;

  useFocusEffect(
    useCallback(() => {
      const message = takeAssignmentsFlash();
      if (message) setFlash(message);
      void queryClient.refetchQueries({ queryKey: assignmentKeys.lists, stale: true, type: 'active' });
    }, [queryClient]),
  );

  /** A quick double tap must not open a screen twice. */
  const once = () => {
    const now = Date.now();
    if (now - lastOpen.current < 1000) return false;
    lastOpen.current = now;
    setFlash(null);
    return true;
  };

  const refresh = async () => {
    setPulling(true);
    try {
      await Promise.all([students.refetch(), options.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  const filtered = filters.search !== '' || filters.internship_status !== null || filters.status !== null || filters.company_id !== null;
  const companyLabel =
    filters.company_id === null
      ? 'All Companies'
      : filters.company_id === 'none'
        ? 'Unassigned'
        : (options.data?.companies.find((c) => c.id === filters.company_id)?.company_name ?? 'Company');

  const header = (
    <View className="gap-3 pb-3 pt-4">
      <Text className="px-4 text-sm text-gray-600">{SUBTITLE}</Text>
      {flash ? (
        <View className="px-4">
          <Banner tone="success" message={flash} />
        </View>
      ) : null}
      <View className="px-4">
        <SearchField
          placeholder="Filter by student name..."
          maxLength={ASSIGNMENT_SEARCH_MAX}
          onSearch={(search) => setFilters((f) => ({ ...f, search }))}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 px-4" accessibilityLabel="Filters">
        <Pressable
          onPress={() => setCompanyPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Company filter: ${companyLabel}`}
          hitSlop={{ top: 6, bottom: 6 }}
          className={`h-9 max-w-56 flex-row items-center gap-1 rounded-full border px-3.5 ${
            filters.company_id !== null ? 'border-brand-700 bg-brand-50' : 'border-gray-300 bg-white active:bg-gray-100'
          }`}>
          <Text
            className={`shrink text-sm ${filters.company_id !== null ? 'font-semibold text-brand-700' : 'font-medium text-gray-700'}`}
            numberOfLines={1}>
            {companyLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={filters.company_id !== null ? colors.brand700 : colors.gray500} />
        </Pressable>
        <View className="h-5 w-px bg-gray-300" />
        <FilterChip
          label="All Statuses"
          selected={filters.internship_status === null}
          onPress={() => setFilters((f) => ({ ...f, internship_status: null }))}
        />
        {INTERNSHIP_STATUSES.map((status) => (
          <FilterChip
            key={status.value}
            label={status.label}
            selected={filters.internship_status === status.value}
            onPress={() => setFilters((f) => ({ ...f, internship_status: status.value }))}
          />
        ))}
        <View className="h-5 w-px bg-gray-300" />
        <FilterChip
          label="Inactive Accounts"
          selected={filters.status === 'inactive'}
          onPress={() => setFilters((f) => ({ ...f, status: f.status === 'inactive' ? null : 'inactive' }))}
        />
      </ScrollView>
      {students.isRefetchError && items.length > 0 ? (
        <View className="px-4">
          <Banner tone="warning" message={`Showing saved data. ${toApiError(students.error).message}`} />
        </View>
      ) : null}
      {items.length > 0 ? (
        <Text className="px-4 text-xs text-gray-500" style={TABULAR}>
          {total === 1 ? '1 student' : `${total} students`}
        </Text>
      ) : null}
    </View>
  );

  let empty: ReactElement;
  if (students.isPending) empty = <ListSkeleton />;
  else if (students.isError) {
    empty = (
      <View className="px-4">
        <ErrorState message={toApiError(students.error).message} onRetry={() => void students.refetch()} retrying={students.isFetching} />
      </View>
    );
  } else if (filtered) {
    empty = <EmptyState icon="filter-outline" message="No students match these filters." />;
  } else {
    // Website empty table text.
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
            item={item}
            onOpen={() => {
              if (once()) router.push({ pathname: '/assignment/[id]', params: { id: String(item.id) } });
            }}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          students.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more students" />
            </View>
          ) : students.isFetchNextPageError ? (
            <View className="items-center gap-2 px-4 py-6">
              <Text className="text-center text-sm text-gray-600">{toApiError(students.error).message}</Text>
              <Button label="Try again" variant="outline" onPress={() => void students.fetchNextPage()} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (students.hasNextPage && !students.isFetchingNextPage && !students.isFetchNextPageError) void students.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
      />

      <SelectSheet
        visible={companyPicker}
        title="Company"
        allLabel="All Companies"
        options={[
          { value: UNASSIGNED_OPTION, label: 'Unassigned' },
          ...(options.data?.companies ?? []).map((c) => ({ value: c.id, label: c.company_name })),
        ]}
        selected={filters.company_id === 'none' ? UNASSIGNED_OPTION : filters.company_id}
        onSelect={(value) => setFilters((f) => ({ ...f, company_id: value === UNASSIGNED_OPTION ? 'none' : value }))}
        onClose={() => setCompanyPicker(false)}
      />
    </View>
  );
}
