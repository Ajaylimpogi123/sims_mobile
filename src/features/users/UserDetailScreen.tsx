import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/errors';
import type { ManagedUser } from '@/api/types';
import { useSetUserActive, userFromLists, useUser } from '@/api/users';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/datetime';
import { colors } from '@/theme/colors';

import { setUsersFlash, takeUserDetailFlash } from './flash';

const TITLE = 'User';
export const USER_NOT_FOUND = "We couldn't find that user. It may have been removed.";

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={16} color={colors.gray500} />
      <Text className="flex-1 text-sm text-gray-600">{text}</Text>
    </View>
  );
}

function HeaderCard({ user }: { user: ManagedUser }) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text accessibilityRole="header" className="text-xl font-semibold text-gray-900">
            {user.name}
          </Text>
          {user.is_self ? <Text className="text-sm text-gray-500">This is your account.</Text> : null}
        </View>
        <StatusBadge status={user.status || 'active'} />
      </View>
      <View className="mt-3 gap-1.5">
        <Meta icon="mail-outline" text={user.email} />
        <Meta icon="person-outline" text={`Role: ${user.role || '-'}`} />
        {user.created_at ? <Meta icon="calendar-outline" text={`Registered ${formatDate(user.created_at)}`} /> : null}
      </View>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <SkeletonPulse label="Loading user">
      <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <SkeletonBlock className="h-6 w-1/2" />
        <SkeletonBlock className="h-4 w-2/3" />
        <SkeletonBlock className="h-4 w-1/3" />
      </View>
    </SkeletonPulse>
  );
}

/**
 * One account (website: a UsersTable row with its Edit / Activate / Deactivate buttons). Buttons
 * follow the API's can_edit / can_toggle_status; the server enforces every rule (e.g. 403 on your
 * own status, 404 on an Administrator for a coordinator).
 */
export function UserDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const [initial] = useState(() => (id === null ? undefined : userFromLists(queryClient, id)));
  const query = useUser(id);
  const setActive = useSetUserActive();
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const inFlight = useRef(false);
  const lastOpen = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const message = takeUserDetailFlash();
      if (message) {
        setFlash(message);
        setProblem(null);
      }
    }, []),
  );

  const apiError = query.isError ? toApiError(query.error) : null;
  const gone = id === null || apiError?.kind === 'not_found';
  const user = gone ? undefined : (query.data ?? initial);

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  if (gone) {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title: TITLE }} />
        <EmptyState icon="alert-circle-outline" message={USER_NOT_FOUND} />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  const toggle = async (target: ManagedUser, active: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFlash(null);
    setProblem(null);
    try {
      const response = await setActive.mutateAsync({ id: target.id, active });
      setFlash(response.message);
      setUsersFlash(response.message);
    } catch (error) {
      const failure = toApiError(error);
      // 422 errors.status, e.g. "At least one active Administrator is required."
      setProblem(failure.kind === 'not_found' ? USER_NOT_FOUND : (failure.fieldErrors.status ?? failure.message));
    } finally {
      inFlight.current = false;
    }
  };

  const confirmToggle = (target: ManagedUser) => {
    const isActive = target.status !== 'inactive';
    // Website SweetAlert wording, plus what deactivating means for the phone app.
    Alert.alert(
      isActive ? 'Deactivate Account?' : 'Activate Account?',
      isActive
        ? `Deactivate "${target.name}"? They will no longer be able to log in, and they will be signed out of the mobile app.`
        : `Reactivate "${target.name}"? They will be able to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isActive ? 'Deactivate' : 'Activate', style: isActive ? 'destructive' : 'default', onPress: () => void toggle(target, !isActive) },
      ],
    );
  };

  const openEdit = () => {
    const now = Date.now();
    if (!user || now - lastOpen.current < 1000) return;
    lastOpen.current = now;
    setFlash(null);
    setProblem(null);
    router.push({ pathname: '/user-form', params: { id: String(user.id) } });
  };

  const isActive = user?.status !== 'inactive';
  const showActions = !!user && (user.can_edit || user.can_toggle_status);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: TITLE }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 p-4"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
        {flash ? <Banner tone="success" message={flash} /> : null}
        {problem ? <Banner tone="error" message={problem} /> : null}
        {user && query.isError ? <Banner tone="warning" message={`Showing saved data. ${apiError?.message ?? ''}`.trim()} /> : null}
        {user ? (
          <HeaderCard user={user} />
        ) : query.isError ? (
          <ErrorState message={apiError?.message ?? ''} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : (
          <DetailSkeleton />
        )}
        {user && !isActive ? (
          <Text className="px-1 text-sm text-gray-600">This account is deactivated and can't log in to the website or the app.</Text>
        ) : null}
      </ScrollView>

      {showActions ? (
        <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          {user.can_toggle_status ? (
            <Button
              label={isActive ? 'Deactivate' : 'Activate'}
              icon={isActive ? 'person-remove-outline' : 'person-add-outline'}
              variant={isActive ? 'danger' : 'outline'}
              onPress={() => confirmToggle(user)}
              loading={setActive.isPending}
              loadingLabel={isActive ? 'Deactivating…' : 'Activating…'}
              className="flex-1"
            />
          ) : null}
          {user.can_edit ? (
            <Button label="Edit" icon="create-outline" onPress={openEdit} disabled={setActive.isPending} className="flex-1" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
