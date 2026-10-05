import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { toApiError } from '@/api/errors';
import type { ManagedUser, UserFilters, UserStatus } from '@/api/types';
import { NO_USER_FILTERS, USER_SEARCH_MAX, userKeys, useUsers } from '@/api/users';
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

import { takeUsersFlash } from './flash';

/** Website subtitle (UserManagement/Index.jsx). */
const SUBTITLE = 'Register users and manage accounts by role';

/** Website "Filter by Status" options. */
const STATUSES: { value: UserStatus | null; label: string }[] = [
  { value: null, label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Deactivated' },
];

// ---------------------------------------------------------------------------
// Card (website row: Name, Email, Role, Status, Actions)
// ---------------------------------------------------------------------------

function UserCard({ item, onOpen }: { item: ManagedUser; onOpen: () => void }) {
  const status = item.status || 'active';
  const label = [item.name, item.is_self ? 'you' : null, item.email, item.role ?? 'No role', status === 'inactive' ? 'Inactive' : 'Active']
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the account"
      className="mx-4 mb-3 gap-1 rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50">
      <View className="flex-row items-center gap-2">
        <Text className="flex-shrink text-base font-semibold text-gray-900" numberOfLines={1}>
          {item.name}
        </Text>
        {item.is_self ? <Text className="text-xs font-medium text-gray-500">(You)</Text> : null}
        <View className="flex-1" />
        <StatusBadge status={status} />
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </View>
      <Text className="text-sm text-gray-600" numberOfLines={1}>
        {item.email}
      </Text>
      <Text className="text-xs text-gray-500" numberOfLines={1}>
        {item.role || '-'}
      </Text>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <SkeletonPulse label="Loading users">
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} className="mx-4 mb-3 gap-2 rounded-2xl border border-gray-200 bg-white p-4">
          <View className="flex-row justify-between">
            <SkeletonBlock className="h-5 w-1/2" />
            <SkeletonBlock className="h-5 w-14 rounded-full" />
          </View>
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-3 w-1/4" />
        </View>
      ))}
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * User Management (website: UserManagement/Index.jsx), Coordinator + Admin. The API scopes the
 * list (coordinators never get Administrator accounts), sends the filter roles, `can_create` and
 * each row's flags. Tap an account for its detail (Edit, Activate / Deactivate).
 */
export function UsersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<UserFilters>(NO_USER_FILTERS);
  const users = useUsers(filters);
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const lastOpen = useRef(0);

  const pages = users.data?.pages ?? [];
  const items = pages.flatMap((page) => page.data);
  const first = pages[0];
  const roles = first?.roles ?? [];
  const canCreate = first?.can_create === true;
  const total = pages[pages.length - 1]?.meta.total ?? 0;

  useFocusEffect(
    useCallback(() => {
      const message = takeUsersFlash();
      if (message) setFlash(message);
      void queryClient.refetchQueries({ queryKey: userKeys.lists, stale: true, type: 'active' });
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
      await users.refetch();
    } finally {
      setPulling(false);
    }
  };

  const filtered = filters.roleId !== null || filters.status !== null || filters.search !== '';

  const header = (
    <View className="gap-3 pb-3 pt-4">
      <Text className="px-4 text-sm text-gray-600">{SUBTITLE}</Text>
      {flash ? (
        <View className="px-4">
          <Banner tone="success" message={flash} />
        </View>
      ) : null}
      <View className="px-4">
        <SearchField placeholder="Search by name or email..." maxLength={USER_SEARCH_MAX} onSearch={(search) => setFilters((f) => ({ ...f, search }))} />
      </View>
      {roles.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 px-4" accessibilityLabel="Filter by Role">
          <FilterChip label="All Roles" selected={filters.roleId === null} onPress={() => setFilters((f) => ({ ...f, roleId: null }))} />
          {roles.map((role) => (
            <FilterChip
              key={role.id}
              label={role.role_name}
              selected={filters.roleId === role.id}
              onPress={() => setFilters((f) => ({ ...f, roleId: role.id }))}
            />
          ))}
        </ScrollView>
      ) : null}
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
      {users.isRefetchError && items.length > 0 ? (
        <View className="px-4">
          <Banner tone="warning" message={`Showing saved data. ${toApiError(users.error).message}`} />
        </View>
      ) : null}
      {first && items.length > 0 ? (
        <Text className="px-4 text-xs text-gray-500" style={TABULAR}>
          {total === 1 ? '1 user' : `${total} users`}
        </Text>
      ) : null}
    </View>
  );

  let empty: ReactElement;
  if (users.isPending) empty = <ListSkeleton />;
  else if (users.isError) {
    empty = (
      <View className="px-4">
        <ErrorState message={toApiError(users.error).message} onRetry={() => void users.refetch()} retrying={users.isFetching} />
      </View>
    );
  } else if (filtered) {
    empty = <EmptyState icon="filter-outline" message="No users match these filters." />;
  } else {
    // Website empty row text.
    empty = <EmptyState icon="people-outline" message="No users found." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        className="flex-1"
        contentContainerClassName={canCreate ? 'pb-28' : 'pb-8'}
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <UserCard
            item={item}
            onOpen={() => {
              if (once()) router.push({ pathname: '/user/[id]', params: { id: String(item.id) } });
            }}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          users.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more users" />
            </View>
          ) : users.isFetchNextPageError ? (
            <View className="items-center gap-2 px-4 py-6">
              <Text className="text-center text-sm text-gray-600">{toApiError(users.error).message}</Text>
              <Button label="Try again" variant="outline" onPress={() => void users.fetchNextPage()} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (users.hasNextPage && !users.isFetchingNextPage && !users.isFetchNextPageError) void users.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
      />

      {/* Thumb-zone primary action (website: the User Registration card's "Register User"), only when the API allows. */}
      {canCreate ? (
        <Pressable
          onPress={() => {
            if (once()) router.push('/user-form');
          }}
          accessibilityRole="button"
          accessibilityLabel="Register User"
          className="absolute bottom-5 right-4 h-14 flex-row items-center gap-2 rounded-2xl bg-brand-700 px-5 active:bg-brand-800"
          style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
          <Ionicons name="person-add" size={20} color={colors.white} />
          <Text className="text-base font-semibold text-white">Register User</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
