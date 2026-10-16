import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { toApiError } from '@/api/errors';
import { ArchivedTermBanner } from '@/features/terms/TermSwitcher';
import { evaluationKeys, NO_EVALUATION_FILTERS, useEvaluations } from '@/api/evaluations';
import { ROLE_SUPERVISOR, type EvaluationFilters, type EvaluationStatus, type EvaluationSummary } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterChip } from '@/components/ui/FilterChip';
import { SearchField } from '@/components/ui/SearchField';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { formatFeedbackPeriod, formatRating } from '../feedback/format';

import { EvaluationStatusBadge } from './EvaluationStatusBadge';
import { takeEvaluationsFlash } from './flash';
import { STATUS_LABEL } from './format';
import { Text } from '@/components/ui/Text';

const HIGHLIGHT_MS = 3000;

/** Website subtitle (SupervisorEvaluations/Index.jsx). */
const SUBTITLE = 'Evaluate assigned students against the configured evaluation criteria';

const STATUSES: (EvaluationStatus | null)[] = [null, 'draft', 'submitted', 'locked'];

// ---------------------------------------------------------------------------
// Card (website row: Student, Company, Supervisor, Period, Overall Rating, Status, View)
// ---------------------------------------------------------------------------

function EvaluationCard({ item, highlighted, onOpen }: { item: EvaluationSummary; highlighted: boolean; onOpen: () => void }) {
  const period = formatFeedbackPeriod(item);
  const rating = formatRating(item.overall_rating);
  const label = [
    item.student?.name ?? '—',
    period,
    `Overall Rating ${rating} out of ${item.rating_max}`,
    STATUS_LABEL[item.status] ?? item.status,
  ].join(', ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={item.can_edit ? 'Opens the evaluation to continue editing' : 'Opens the evaluation'}
      className={`mx-4 mb-3 gap-2 rounded-xl border p-4 ${highlighted ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white active:bg-gray-50'}`}>
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {item.student?.name ?? '—'}
          </Text>
          <Text className="text-sm text-gray-600" numberOfLines={1}>
            {[item.student?.student_number, item.company?.name].filter(Boolean).join(' · ') || '—'}
          </Text>
        </View>
        <EvaluationStatusBadge status={item.status} />
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </View>
      <View className="flex-row flex-wrap items-center gap-1.5">
        <Text className="text-sm text-gray-700" style={TABULAR}>
          {period}
        </Text>
        <Text className="text-sm text-gray-400">·</Text>
        <Text className="text-sm text-gray-700" style={TABULAR}>
          <Text className="font-semibold text-gray-900">{rating}</Text>/{item.rating_max}
        </Text>
      </View>
      <Text className="text-xs text-gray-500" numberOfLines={1}>
        Supervisor: {item.supervisor?.name || '—'}
      </Text>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <SkeletonPulse label="Loading evaluations">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="mx-4 mb-3 gap-3 rounded-xl border border-gray-200 bg-white p-4">
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

/**
 * Supervisor Monitoring & Feedback (website: SupervisorEvaluations/Index.jsx). Supervisor: own
 * students; Coordinator: view only; Admin: all. The API scopes the list and sends `can_create`
 * and the per-row flags. `?evaluation_id=` highlights that evaluation, or opens it when it isn't on
 * the loaded pages.
 */
export function EvaluationsList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ evaluation_id?: string }>();
  const [filters, setFilters] = useState<EvaluationFilters>(NO_EVALUATION_FILTERS);
  const evaluations = useEvaluations(filters);
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const listRef = useRef<FlatList<EvaluationSummary>>(null);
  const lastOpen = useRef(0);

  const items = evaluations.data?.pages.flatMap((page) => page.data) ?? [];
  const { me } = useAuth();
  // Website: only Supervisors get "New Evaluation" (the API also allows Admins; the app follows the website).
  const canCreate = me?.user.role_id === ROLE_SUPERVISOR && evaluations.data?.pages[0]?.can_create === true;

  useFocusEffect(
    useCallback(() => {
      const message = takeEvaluationsFlash();
      if (message) setFlash(message);
      void queryClient.refetchQueries({ queryKey: evaluationKeys.lists, stale: true, type: 'active' });
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

  const open = useCallback(
    (id: number) => {
      const now = Date.now();
      if (now - lastOpen.current < 1000) return;
      lastOpen.current = now;
      setFlash(null);
      router.push({ pathname: '/evaluation/[id]', params: { id: String(id) } });
    },
    [router],
  );

  const targetId = params.evaluation_id;
  const handledTarget = useRef<string | null>(null);
  const loaded = !evaluations.isPending;
  useEffect(() => {
    if (!targetId) {
      handledTarget.current = null;
      return;
    }
    if (!loaded || handledTarget.current === targetId) return;
    handledTarget.current = targetId;
    router.setParams({ evaluation_id: undefined });
    if (!/^\d+$/.test(targetId)) return;

    const id = Number(targetId);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) {
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
      await evaluations.refetch();
    } finally {
      setPulling(false);
    }
  };

  const filtered = filters.status !== null || filters.search !== '';

  const header = (
    <View className="gap-3 pb-3 pt-4">
      <View className="px-4">
        <ArchivedTermBanner />
      </View>
      <Text className="px-4 text-sm text-gray-600">{SUBTITLE}</Text>
      {flash ? (
        <View className="px-4">
          <Banner tone="success" message={flash} />
        </View>
      ) : null}
      <View className="px-4">
        <SearchField placeholder="Search by student name or number..." maxLength={255} onSearch={(search) => setFilters((f) => ({ ...f, search }))} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 px-4" accessibilityLabel="Filter evaluations">
        {STATUSES.map((status) => (
          <FilterChip
            key={status ?? 'all'}
            label={status ? STATUS_LABEL[status] : 'All'}
            selected={filters.status === status}
            onPress={() => setFilters((f) => ({ ...f, status }))}
          />
        ))}
      </ScrollView>
      {evaluations.isRefetchError && items.length > 0 ? (
        <View className="px-4">
          <Banner tone="warning" message={`Showing saved data. ${toApiError(evaluations.error).message}`} />
        </View>
      ) : null}
    </View>
  );

  let empty: ReactElement;
  if (evaluations.isPending) empty = <ListSkeleton />;
  else if (evaluations.isError) {
    empty = (
      <View className="px-4">
        <ErrorState message={toApiError(evaluations.error).message} onRetry={() => void evaluations.refetch()} retrying={evaluations.isFetching} />
      </View>
    );
  } else if (filtered) {
    empty = <EmptyState icon="filter-outline" message="No evaluations match these filters." />;
  } else {
    // Website empty row text.
    empty = <EmptyState icon="star-outline" message="No evaluations yet." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        ref={listRef}
        className="flex-1"
        contentContainerClassName={canCreate ? 'pb-28' : 'pb-8'}
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <EvaluationCard item={item} highlighted={item.id === highlightId} onOpen={() => open(item.id)} />}
        extraData={highlightId}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          evaluations.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading more evaluations" />
            </View>
          ) : evaluations.isFetchNextPageError ? (
            <View className="items-center gap-2 px-4 py-6">
              <Text className="text-center text-sm text-gray-600">{toApiError(evaluations.error).message}</Text>
              <Button label="Try again" variant="outline" onPress={() => void evaluations.fetchNextPage()} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (evaluations.hasNextPage && !evaluations.isFetchingNextPage && !evaluations.isFetchNextPageError) void evaluations.fetchNextPage();
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

      {/* Thumb-zone primary action (website: the "New Evaluation" button), only when the API allows. */}
      {canCreate ? (
        <Pressable
          onPress={() => {
            if (once()) router.push('/evaluation-form');
          }}
          accessibilityRole="button"
          accessibilityLabel="New Evaluation"
          className="absolute bottom-5 right-4 h-14 flex-row items-center gap-2 rounded-xl bg-brand-700 px-5 active:bg-brand-800"
          style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
          <Ionicons name="add" size={22} color={colors.white} />
          <Text className="text-base font-semibold text-white">New Evaluation</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
