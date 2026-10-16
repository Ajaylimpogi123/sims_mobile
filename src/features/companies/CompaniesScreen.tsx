import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { COMPANY_SEARCH_MAX, companyKeys, NO_COMPANY_FILTERS, useCompanies } from '@/api/companies';
import { toApiError } from '@/api/errors';
import type { CompanyFilters, CompanyStatus, ManagedCompany } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChip } from '@/components/ui/FilterChip';
import { SearchField } from '@/components/ui/SearchField';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { SupervisorFlag, supervisorFlagLabel } from '@/features/assignments/SupervisorFlag';

import { takeCompaniesFlash } from './flash';
import { Text } from '@/components/ui/Text';

/** Website subtitle (CompanyManagement/Index.jsx). */
const SUBTITLE = 'Manage internship partner companies and their available slots';

/** The website's status values (its badge says Active / Inactive). */
const STATUSES: { value: CompanyStatus | null; label: string }[] = [
  { value: null, label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/** Website "Slots" column: students assigned / total slots. */
export function slotsLabel(company: Pick<ManagedCompany, 'students_count' | 'slots'>) {
  return `${company.students_count ?? 0} / ${company.slots}`;
}

// ---------------------------------------------------------------------------
// Card (website row: Company Name, Company Supervisor, Contact Number, Industry, Slots, Status)
// ---------------------------------------------------------------------------

function CompanyCard({ item, onOpen }: { item: ManagedCompany; onOpen: () => void }) {
  const flag = supervisorFlagLabel(item);
  // A flagged supervisor shows the amber pill; the name stays visible when there is one.
  const contact = [item.supervisor?.name, item.contact_number].filter(Boolean).join(' · ');
  const full = item.slots > 0 && item.students_count >= item.slots;
  const label = [
    item.company_name,
    item.status === 'active' ? 'Active' : 'Inactive',
    item.supervisor ? `Supervisor ${item.supervisor.name}` : null,
    flag,
    item.contact_number,
    item.industry ? `Industry ${item.industry}` : null,
    `Slots ${item.students_count ?? 0} of ${item.slots} used`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the company"
      className="mx-4 mb-3 gap-1 rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-base font-semibold text-gray-900" numberOfLines={2}>
          {item.company_name}
        </Text>
        <StatusBadge status={item.status} />
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </View>
      {contact ? (
        <Text className="text-sm text-gray-600" numberOfLines={1}>
          {contact}
        </Text>
      ) : null}
      <SupervisorFlag subject={item} />
      <View className="mt-1 flex-row items-center gap-3">
        <Text className="flex-1 text-xs text-gray-500" numberOfLines={1}>
          {item.industry || '-'}
        </Text>
        <View className="flex-row items-center gap-1">
          <Ionicons name="people-outline" size={14} color={full ? colors.amber700 : colors.gray500} />
          <Text className={`text-xs font-medium ${full ? 'text-amber-700' : 'text-gray-700'}`} style={TABULAR}>
            {slotsLabel(item)} slots
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <SkeletonPulse label="Loading companies">
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} className="mx-4 mb-3 gap-2 rounded-xl border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="h-5 w-14 rounded-full" />
          </View>
          <SkeletonBlock className="h-4 w-2/3" />
          <View className="flex-row justify-between">
            <SkeletonBlock className="h-3 w-1/4" />
            <SkeletonBlock className="h-3 w-16" />
          </View>
        </View>
      ))}
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Company Management (website: CompanyManagement/Index.jsx), Coordinator + Admin. Tap a company
 * for its detail (info, Company Supervisor, Edit, Activate / Deactivate, Delete).
 */
export function CompaniesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CompanyFilters>(NO_COMPANY_FILTERS);
  const companies = useCompanies(filters);
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const lastOpen = useRef(0);

  const pages = companies.data?.pages ?? [];
  const items = pages.flatMap((page) => page.data);
  const first = pages[0];
  const canCreate = first?.can_create === true;
  const total = pages[pages.length - 1]?.meta.total ?? 0;

  useFocusEffect(
    useCallback(() => {
      const message = takeCompaniesFlash();
      if (message) setFlash(message);
      void queryClient.refetchQueries({ queryKey: companyKeys.lists, stale: true, type: 'active' });
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
      await companies.refetch();
    } finally {
      setPulling(false);
    }
  };

  const filtered = filters.status !== null || filters.search !== '';

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
          placeholder="Filter by company name..."
          maxLength={COMPANY_SEARCH_MAX}
          onSearch={(search) => setFilters((f) => ({ ...f, search }))}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 px-4" accessibilityLabel="Filter by Status">
        {STATUSES.map((status) => (
          <FilterChip
            key={status.value ?? 'all'}
            label={status.label}
            selected={filters.status === status.value}
            onPress={() => setFilters((f) => ({ ...f, status: status.value }))}
          />
        ))}
      </ScrollView>
      {companies.isRefetchError && items.length > 0 ? (
        <View className="px-4">
          <Banner tone="warning" message={`Showing saved data. ${toApiError(companies.error).message}`} />
        </View>
      ) : null}
      {first && items.length > 0 ? (
        <Text className="px-4 text-xs text-gray-500" style={TABULAR}>
          {total === 1 ? '1 company' : `${total} companies`}
        </Text>
      ) : null}
    </View>
  );

  let empty: ReactElement;
  if (companies.isPending) empty = <ListSkeleton />;
  else if (companies.isError) {
    empty = (
      <View className="px-4">
        <ErrorState message={toApiError(companies.error).message} onRetry={() => void companies.refetch()} retrying={companies.isFetching} />
      </View>
    );
  } else if (filtered) {
    empty = <EmptyState icon="filter-outline" message="No companies match these filters." />;
  } else {
    // Website empty table text.
    empty = <EmptyState icon="business-outline" message="No results." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        className="flex-1"
        contentContainerClassName={canCreate ? 'pb-28' : 'pb-8'}
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <CompanyCard
            item={item}
            onOpen={() => {
              if (once()) router.push({ pathname: '/company/[id]', params: { id: String(item.id) } });
            }}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          companies.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more companies" />
            </View>
          ) : companies.isFetchNextPageError ? (
            <View className="items-center gap-2 px-4 py-6">
              <Text className="text-center text-sm text-gray-600">{toApiError(companies.error).message}</Text>
              <Button label="Try again" variant="outline" onPress={() => void companies.fetchNextPage()} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (companies.hasNextPage && !companies.isFetchingNextPage && !companies.isFetchNextPageError) void companies.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
      />

      {/* Thumb-zone primary action (website: "Add Company" in the page header), only when the API allows. */}
      {canCreate ? (
        <Pressable
          onPress={() => {
            if (once()) router.push('/company-form');
          }}
          accessibilityRole="button"
          accessibilityLabel="Add Company"
          className="absolute bottom-5 right-4 h-14 flex-row items-center gap-2 rounded-xl bg-brand-700 px-5 active:bg-brand-800"
          style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
          <Ionicons name="add" size={22} color={colors.white} />
          <Text className="text-base font-semibold text-white">Add Company</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
