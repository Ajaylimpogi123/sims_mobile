import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, View } from 'react-native';

import { toApiError } from '@/api/errors';
import { useDeleteCriterion, useManagedCriteria, useSetCriterionActive } from '@/api/evaluations';
import type { ManagedCriterion } from '@/api/types';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { takeCriteriaFlash } from './flash';
import { Text } from '@/components/ui/Text';

/** Website subtitle (EvaluationCriteria/Index.jsx). */
const SUBTITLE = 'Configure the criteria supervisors rate students against — add, edit, or deactivate without touching the database';

function CriterionRow({ item, busy, onPress }: { item: ManagedCriterion; busy: boolean; onPress: () => void }) {
  const responses = `${item.responses_count} ${item.responses_count === 1 ? 'response' : 'responses'}`;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}, ${item.is_active ? 'Active' : 'Inactive'}, sort ${item.sort_order}, ${responses}`}
      accessibilityHint="Shows Edit, Activate or Deactivate, and Delete"
      className="mx-4 flex-row items-start gap-3 border-x border-b border-gray-200 bg-white px-4 py-3 active:bg-gray-50">
      <View className="flex-1 gap-1">
        <Text className={`text-base font-medium ${item.is_active ? 'text-gray-900' : 'text-gray-500'}`}>{item.label}</Text>
        {item.description ? (
          <Text className="text-sm text-gray-600" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <Text className="text-xs text-gray-500" style={TABULAR}>
          Sort {item.sort_order} · {responses}
        </Text>
      </View>
      <View className="items-end gap-2">
        <StatusBadge status={item.is_active ? 'active' : 'inactive'} />
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.gray400} />
      </View>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <SkeletonPulse label="Loading criteria">
      <View className="gap-3 px-4">
        {[0, 1].map((i) => (
          <View key={i} className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-5 w-2/3" />
            <SkeletonBlock className="h-5 w-1/2" />
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

/**
 * Evaluation Criteria (website: EvaluationCriteria/Index.jsx), Admin only: every criterion grouped
 * by category, inactive ones included. Tap a criterion for Edit / Activate or Deactivate / Delete;
 * "Add Criterion" opens the form.
 */
export function CriteriaScreen() {
  const router = useRouter();
  const criteria = useManagedCriteria();
  const setActive = useSetCriterionActive();
  const remove = useDeleteCriterion();
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [selected, setSelected] = useState<ManagedCriterion | null>(null);
  const inFlight = useRef(false);
  const lastOpen = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const message = takeCriteriaFlash();
      if (message) {
        setFlash(message);
        setProblem(null);
      }
    }, []),
  );

  const sections = useMemo(() => {
    const groups = new Map<string, ManagedCriterion[]>();
    for (const item of criteria.data ?? []) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [criteria.data]);

  const refresh = async () => {
    setPulling(true);
    try {
      await criteria.refetch();
    } finally {
      setPulling(false);
    }
  };

  const openForm = (id?: number) => {
    const now = Date.now();
    if (now - lastOpen.current < 1000) return;
    lastOpen.current = now;
    setFlash(null);
    setProblem(null);
    router.push(id === undefined ? '/criterion-form' : { pathname: '/criterion-form', params: { id: String(id) } });
  };

  const run = async (work: () => Promise<{ message: string }>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFlash(null);
    setProblem(null);
    try {
      const response = await work();
      setFlash(response.message);
    } catch (error) {
      const apiError = toApiError(error);
      setProblem(apiError.kind === 'not_found' ? 'That criterion no longer exists. The list has been refreshed.' : apiError.message);
    } finally {
      inFlight.current = false;
    }
  };

  const confirmDelete = (item: ManagedCriterion) => {
    // Website wording; the server decides (it deactivates instead when there are responses).
    const message = item.responses_count
      ? 'This criterion already has evaluation responses, so it will be deactivated instead of deleted. Continue?'
      : 'Delete this criterion?';
    Alert.alert(item.responses_count ? 'Deactivate criterion?' : 'Delete criterion?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: item.responses_count ? 'Continue' : 'Delete', style: 'destructive', onPress: () => void run(() => remove.mutateAsync(item.id)) },
    ]);
  };

  const onAction = (key: string) => {
    const item = selected;
    setSelected(null);
    if (!item) return;
    if (key === 'edit') openForm(item.id);
    else if (key === 'toggle') void run(() => setActive.mutateAsync({ id: item.id, active: !item.is_active }));
    else if (key === 'delete') confirmDelete(item);
  };

  const busy = setActive.isPending || remove.isPending;

  const header = (
    <View className="gap-3 px-4 pb-3 pt-4">
      <Text className="text-sm text-gray-600">{SUBTITLE}</Text>
      {flash ? <Banner tone="success" message={flash} /> : null}
      {problem ? <Banner tone="error" message={problem} /> : null}
      {criteria.isRefetchError && criteria.data ? <Banner tone="warning" message={`Showing saved data. ${toApiError(criteria.error).message}`} /> : null}
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {criteria.isPending ? (
        <>
          {header}
          <ListSkeleton />
        </>
      ) : criteria.isError && !criteria.data ? (
        <>
          {header}
          <View className="px-4">
            <ErrorState message={toApiError(criteria.error).message} onRetry={() => void criteria.refetch()} retrying={criteria.isFetching} />
          </View>
        </>
      ) : (
        <SectionList
          className="flex-1"
          contentContainerClassName="pb-28"
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon="list-outline" message="No criteria configured yet." />}
          renderSectionHeader={({ section }) => (
            <Text accessibilityRole="header" className="mx-4 mt-3 rounded-t-2xl border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900">
              {section.title}
            </Text>
          )}
          renderSectionFooter={() => <View className="mx-4 mb-1 h-3 rounded-b-2xl border-x border-b border-gray-200 bg-white" />}
          renderItem={({ item }) => <CriterionRow item={item} busy={busy} onPress={() => setSelected(item)} />}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
        />
      )}

      <Pressable
        onPress={() => openForm()}
        accessibilityRole="button"
        accessibilityLabel="Add Criterion"
        className="absolute bottom-5 right-4 h-14 flex-row items-center gap-2 rounded-2xl bg-brand-700 px-5 active:bg-brand-800"
        style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
        <Ionicons name="add" size={22} color={colors.white} />
        <Text className="text-base font-semibold text-white">Add Criterion</Text>
      </Pressable>

      <ActionSheet
        visible={selected !== null}
        title={selected?.label ?? ''}
        options={
          selected
            ? [
                { key: 'edit', label: 'Edit', icon: 'create-outline' },
                selected.is_active
                  ? { key: 'toggle', label: 'Deactivate', hint: 'Hidden from new evaluations; saved ratings stay', icon: 'pause-circle-outline' }
                  : { key: 'toggle', label: 'Activate', hint: 'Shown in the evaluation form again', icon: 'play-circle-outline' },
                {
                  key: 'delete',
                  label: 'Delete',
                  hint: selected.responses_count ? 'Has responses, so it will be deactivated instead' : undefined,
                  icon: 'trash-outline',
                  destructive: true,
                },
              ]
            : []
        }
        onSelect={onAction}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}
