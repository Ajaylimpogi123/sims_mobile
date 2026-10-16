import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { toApiError } from '@/api/errors';
import { useDeleteTerm, useSetCurrentTerm, useTerms } from '@/api/terms';
import type { Term } from '@/api/types';
import { ActionSheet, type ActionSheetOption } from '@/components/ui/ActionSheet';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/datetime';
import { TABULAR } from '@/lib/format';
import { termStatusLabel } from '@/terms/selected-term';
import { colors } from '@/theme/colors';

import { takeTermsFlash } from './flash';

/** Website subtitle (Terms/Index.jsx). */
const SUBTITLE = 'School years and semesters. New registrations and placements go to the current term; past terms are read-only.';
const EMPTY = 'No terms yet. Add one, then set it as current to open registration.';
const GONE = 'That term no longer exists. The list has been refreshed.';

/** "SY 2026-2027" (the website's schoolYearLabel). */
export function schoolYearLabel(start: number | string): string | null {
  const year = Number(start);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return null;
  return `SY ${year}-${year + 1}`;
}

function termDates(term: Term): string | null {
  if (!term.starts_on && !term.ends_on) return null;
  return `${term.starts_on ? formatDate(term.starts_on) : '—'} – ${term.ends_on ? formatDate(term.ends_on) : '—'}`;
}

/** Why Delete is unavailable (website wording); the server refuses the same cases. */
function deleteBlockedReason(term: Term): string | null {
  if (term.can_delete) return null;
  if (term.is_current) return 'Current term';
  if ((term.students_count ?? 0) > 0) return 'Has students';
  return "Can't be deleted";
}

function TermRow({ term, busy, onPress }: { term: Term; busy: boolean; onPress: () => void }) {
  const students = term.students_count ?? 0;
  const studentsText = `${students} ${students === 1 ? 'student' : 'students'}`;
  const dates = termDates(term);
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`${term.label}, ${termStatusLabel(term)}, ${studentsText}${dates ? `, ${dates}` : ''}`}
      accessibilityHint="Shows Edit, Set as current and Delete"
      className="flex-row items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 active:bg-gray-50">
      <View className="flex-1 gap-1">
        <Text className="text-base font-medium text-gray-900">{schoolYearLabel(term.school_year_start) ?? '—'}</Text>
        <Text className="text-sm text-gray-600">{term.semester_label}</Text>
        <Text className="text-xs text-gray-500" style={TABULAR}>
          {dates ? `${dates} · ` : ''}
          {studentsText}
        </Text>
      </View>
      <View className="items-end gap-2">
        {/* Website TermStatusBadge: Current green, Archived gray; Upcoming blue. */}
        <StatusBadge status={termStatusLabel(term).toLowerCase()} />
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.gray400} />
      </View>
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <SkeletonPulse label="Loading terms">
      <View className="gap-3 px-4">
        {[0, 1, 2].map((i) => (
          <View key={i} className="gap-2 rounded-xl border border-gray-200 bg-white p-4">
            <SkeletonBlock className="h-5 w-1/3" />
            <SkeletonBlock className="h-4 w-1/4" />
            <SkeletonBlock className="h-3 w-1/2" />
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

/**
 * Terms (website: Terms/Index.jsx), Coordinator + Admin: every school year / semester, newest first.
 * Tap a term for Edit / Set as current / Delete; "Add Term" opens the form. Buttons follow the
 * server's can_create / can_edit / can_delete; the server re-checks every action.
 */
export function TermsScreen() {
  const router = useRouter();
  const terms = useTerms();
  const setCurrent = useSetCurrentTerm();
  const remove = useDeleteTerm();
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [selected, setSelected] = useState<Term | null>(null);
  const inFlight = useRef(false);
  const lastOpen = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const message = takeTermsFlash();
      if (message) {
        setFlash(message);
        setProblem(null);
      }
    }, []),
  );

  const refresh = async () => {
    setPulling(true);
    try {
      await terms.refetch();
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
    router.push(id === undefined ? '/term-form' : { pathname: '/term-form', params: { id: String(id) } });
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
      setProblem(apiError.kind === 'not_found' ? GONE : apiError.message);
    } finally {
      inFlight.current = false;
    }
  };

  const confirmSetCurrent = (term: Term) =>
    Alert.alert(
      'Set as current term?',
      `Make ${term.label} the current term? New registrations and placements will go to it, and other terms become read-only.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set as current', onPress: () => void run(() => setCurrent.mutateAsync(term.id)) },
      ],
    );

  const confirmDelete = (term: Term) =>
    Alert.alert('Delete term?', `Delete ${term.label}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run(() => remove.mutateAsync(term.id)) },
    ]);

  const onAction = (key: string) => {
    const term = selected;
    setSelected(null);
    if (!term) return;
    if (key === 'edit') openForm(term.id);
    else if (key === 'current') confirmSetCurrent(term);
    else if (key === 'delete' && term.can_delete) confirmDelete(term);
  };

  const actionsFor = (term: Term): ActionSheetOption[] => {
    const blocked = deleteBlockedReason(term);
    const options: ActionSheetOption[] = [];
    if (term.can_edit) options.push({ key: 'edit', label: 'Edit', icon: 'create-outline' });
    if (!term.is_current) {
      options.push({ key: 'current', label: 'Set as current', hint: 'Other terms become read-only', icon: 'checkmark-circle-outline' });
    }
    // Delete stays listed with the reason when refused (the website shows it disabled with a hint).
    options.push({ key: 'delete', label: 'Delete', hint: blocked ?? undefined, icon: 'trash-outline', destructive: true, disabled: !!blocked });
    return options;
  };

  const busy = setCurrent.isPending || remove.isPending;
  const canCreate = terms.data?.can_create ?? false;

  const header = (
    <View className="gap-3 pb-3">
      <Text className="text-sm text-gray-600">{SUBTITLE}</Text>
      {flash ? <Banner tone="success" message={flash} /> : null}
      {problem ? <Banner tone="error" message={problem} /> : null}
      {terms.isRefetchError && terms.data ? <Banner tone="warning" message={`Showing saved data. ${toApiError(terms.error).message}`} /> : null}
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50">
      {terms.isPending ? (
        <View className="pt-4">
          <View className="px-4">{header}</View>
          <ListSkeleton />
        </View>
      ) : terms.isError && !terms.data ? (
        <View className="gap-3 p-4">
          {header}
          <ErrorState message={toApiError(terms.error).message} onRetry={() => void terms.refetch()} retrying={terms.isFetching} />
        </View>
      ) : (
        <FlatList
          className="flex-1"
          contentContainerClassName="gap-3 p-4 pb-28"
          data={terms.data?.data ?? []}
          keyExtractor={(term) => String(term.id)}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon="school-outline" message={EMPTY} />}
          renderItem={({ item }) => <TermRow term={item} busy={busy} onPress={() => setSelected(item)} />}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}
        />
      )}

      {canCreate ? (
        <Pressable
          onPress={() => openForm()}
          accessibilityRole="button"
          accessibilityLabel="Add Term"
          className="absolute bottom-5 right-4 h-14 flex-row items-center gap-2 rounded-xl bg-brand-700 px-5 active:bg-brand-800"
          style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
          <Ionicons name="add" size={22} color={colors.white} />
          <Text className="text-base font-semibold text-white">Add Term</Text>
        </Pressable>
      ) : null}

      <ActionSheet
        visible={selected !== null}
        title={selected?.label ?? ''}
        options={selected ? actionsFor(selected) : []}
        onSelect={onAction}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}
