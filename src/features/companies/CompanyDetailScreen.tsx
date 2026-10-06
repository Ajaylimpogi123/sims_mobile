import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  companyFromLists,
  useAttachSupervisor,
  useCompany,
  useDeleteCompany,
  useDetachSupervisor,
  useSetCompanyActive,
} from '@/api/companies';
import { toApiError } from '@/api/errors';
import type { AvailableSupervisor, CompanyDeleteBlockedReason, ManagedCompany, RosterSupervisor } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { slotsLabel } from './CompaniesScreen';
import { SupervisorPickerSheet } from './SupervisorPickerSheet';
import { COMPANY_NOT_FOUND, setCompaniesFlash, takeCompanyDetailFlash } from './flash';

const TITLE = 'Company';

/** Shown under a disabled Delete; the server's own message wins when it refuses. */
const DELETE_BLOCKED: Record<CompanyDeleteBlockedReason, string> = {
  company_has_students: "This company can't be deleted while students are assigned to it.",
  company_has_evaluations: "This company can't be deleted because evaluations record it.",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Meta({ icon, label, text }: { icon: keyof typeof Ionicons.glyphMap; label: string; text: string | null }) {
  return (
    <View className="flex-row items-start gap-2" accessible accessibilityLabel={`${label}: ${text || 'none'}`}>
      <Ionicons name={icon} size={16} color={colors.gray500} style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-xs text-gray-500">{label}</Text>
        <Text className="text-sm text-gray-900">{text || '-'}</Text>
      </View>
    </View>
  );
}

function HeaderCard({ company }: { company: ManagedCompany }) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <Text accessibilityRole="header" className="flex-1 text-xl font-semibold text-gray-900">
          {company.company_name}
        </Text>
        <StatusBadge status={company.status} />
      </View>
      <View className="mt-4 flex-row gap-3">
        <View className="flex-1 rounded-xl bg-gray-50 p-3" accessible accessibilityLabel={`Slots: ${company.students_count} of ${company.slots} used`}>
          <Text className="text-xs text-gray-500">Slots</Text>
          <Text className="text-lg font-semibold text-gray-900" style={TABULAR}>
            {slotsLabel(company)}
          </Text>
          <Text className="text-xs text-gray-500" style={TABULAR}>
            {plural(company.slots_available, 'slot', 'slots')} available
          </Text>
        </View>
        <View className="flex-1 rounded-xl bg-gray-50 p-3" accessible accessibilityLabel={`Assigned students: ${company.students_count}`}>
          <Text className="text-xs text-gray-500">Assigned Students</Text>
          <Text className="text-lg font-semibold text-gray-900" style={TABULAR}>
            {company.students_count}
          </Text>
          <Text className="text-xs text-gray-500" style={TABULAR}>
            {plural(company.supervisors_count, 'supervisor', 'supervisors')}
          </Text>
        </View>
      </View>
      <View className="mt-4 gap-3">
        <Meta icon="location-outline" label="Address" text={company.address} />
        <Meta icon="person-outline" label="Contact Person" text={company.contact_person} />
        <Meta icon="call-outline" label="Contact Number" text={company.contact_number} />
        <Meta icon="mail-outline" label="Email" text={company.email} />
        <Meta icon="briefcase-outline" label="Industry" text={company.industry} />
      </View>
    </Card>
  );
}

function RosterRow({
  supervisor,
  canRemove,
  removing,
  disabled,
  onRemove,
}: {
  supervisor: RosterSupervisor;
  canRemove: boolean;
  removing: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <View className="min-h-14 flex-row items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="flex-shrink text-sm font-medium text-gray-900" numberOfLines={1}>
            {supervisor.name}
          </Text>
          {supervisor.status === 'inactive' ? <StatusBadge status="inactive" /> : null}
        </View>
        <Text className="text-xs text-gray-500" numberOfLines={1}>
          {supervisor.email}
        </Text>
        {supervisor.students_count > 0 ? (
          <Text className="text-xs text-gray-500" style={TABULAR}>
            Supervises {plural(supervisor.students_count, 'student', 'students')} here
          </Text>
        ) : null}
      </View>
      {canRemove ? (
        removing ? (
          <View className="h-12 w-12 items-center justify-center">
            <ActivityIndicator color={colors.red600} accessibilityLabel={`Removing ${supervisor.name}`} />
          </View>
        ) : (
          <Pressable
            onPress={onRemove}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${supervisor.name}`}
            accessibilityState={{ disabled }}
            className={`h-12 w-12 items-center justify-center rounded-full active:bg-red-50 ${disabled ? 'opacity-50' : ''}`}>
            <Ionicons name="close" size={20} color={colors.red600} />
          </Pressable>
        )
      ) : null}
    </View>
  );
}

function DetailSkeleton() {
  return (
    <SkeletonPulse label="Loading company">
      <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
        <SkeletonBlock className="h-6 w-1/2" />
        <View className="flex-row gap-3">
          <SkeletonBlock className="h-16 flex-1 rounded-xl" />
          <SkeletonBlock className="h-16 flex-1 rounded-xl" />
        </View>
        <SkeletonBlock className="h-4 w-2/3" />
        <SkeletonBlock className="h-4 w-1/2" />
        <SkeletonBlock className="h-4 w-1/3" />
      </View>
    </SkeletonPulse>
  );
}

/**
 * One company (website: a Companies row with its Actions menu: Edit, Manage Supervisors,
 * Activate / Deactivate, Delete). Buttons follow the API's per-company flags; the server enforces
 * every rule (e.g. Delete refused while students are assigned).
 */
export function CompanyDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const [initial] = useState(() => (id === null ? undefined : companyFromLists(queryClient, id)));
  const query = useCompany(id);
  const setActive = useSetCompanyActive();
  const remove = useDeleteCompany();
  const attach = useAttachSupervisor();
  const detach = useDetachSupervisor();
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const deleted = useRef(false);
  const lastOpen = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const message = takeCompanyDetailFlash();
      if (message) {
        setFlash(message);
        setProblem(null);
      }
    }, []),
  );

  const apiError = query.isError ? toApiError(query.error) : null;
  const gone = id === null || apiError?.kind === 'not_found';
  const company = gone ? undefined : (query.data ?? initial);
  const roster = useMemo(() => company?.supervisors ?? [], [company]);
  const rosterIds = useMemo(() => new Set(roster.map((s) => s.id)), [roster]);

  if (gone && !deleted.current) {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title: TITLE }} />
        <EmptyState icon="alert-circle-outline" message={COMPANY_NOT_FOUND} />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  /** One write at a time; shows the server's message either way. */
  const run = async (work: () => Promise<string | null>, failureField?: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFlash(null);
    setProblem(null);
    try {
      const message = await work();
      if (message) setFlash(message);
    } catch (error) {
      const failure = toApiError(error);
      setProblem(
        failure.kind === 'not_found'
          ? COMPANY_NOT_FOUND
          : ((failureField ? failure.fieldErrors[failureField] : undefined) ?? Object.values(failure.fieldErrors)[0] ?? failure.message),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      setRemovingId(null);
    }
  };

  const confirmToggle = (target: ManagedCompany) => {
    const isActive = target.status === 'active';
    Alert.alert(
      isActive ? 'Deactivate Company?' : 'Activate Company?',
      isActive ? `Deactivate "${target.company_name}"?` : `Activate "${target.company_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActive ? 'Deactivate' : 'Activate',
          style: isActive ? 'destructive' : 'default',
          onPress: () =>
            void run(async () => {
              const response = await setActive.mutateAsync({ id: target.id, active: !isActive });
              setCompaniesFlash(response.message);
              return response.message;
            }, 'status'),
        },
      ],
    );
  };

  const confirmDelete = (target: ManagedCompany) => {
    // Website confirm() wording.
    Alert.alert('Delete Company?', `Are you sure you want to delete "${target.company_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            const response = await remove.mutateAsync(target.id);
            deleted.current = true;
            setCompaniesFlash(response.message);
            router.back();
            return null;
          }),
      },
    ]);
  };

  const confirmDetach = (target: ManagedCompany, supervisor: RosterSupervisor) => {
    const keeps =
      supervisor.students_count > 0
        ? ` ${supervisor.name} still supervises ${plural(supervisor.students_count, 'student', 'students')} here; they keep them as their supervisor.`
        : '';
    Alert.alert('Remove Supervisor?', `Remove ${supervisor.name} from the "${target.company_name}" roster?${keeps}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setRemovingId(supervisor.id);
          void run(async () => {
            const response = await detach.mutateAsync({ id: target.id, userId: supervisor.id });
            return response.message;
          });
        },
      },
    ]);
  };

  const pick = (target: ManagedCompany, supervisor: AvailableSupervisor) => {
    setPicking(false);
    void run(async () => {
      const response = await attach.mutateAsync({ id: target.id, userId: supervisor.id });
      return response.message;
    }, 'user_id');
  };

  const openEdit = () => {
    const now = Date.now();
    if (!company || inFlight.current || now - lastOpen.current < 1000) return;
    lastOpen.current = now;
    setFlash(null);
    setProblem(null);
    router.push({ pathname: '/company-form', params: { id: String(company.id) } });
  };

  const isActive = company?.status === 'active';
  const showActions = !!company && (company.can_edit || company.can_toggle_status);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: TITLE }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 p-4"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
        {flash ? <Banner tone="success" message={flash} /> : null}
        {problem ? <Banner tone="error" message={problem} /> : null}
        {company && query.isError ? <Banner tone="warning" message={`Showing saved data. ${apiError?.message ?? ''}`.trim()} /> : null}
        {company ? (
          <>
            <HeaderCard company={company} />

            {/* Website: "Supervisor Roster — <company>" modal. */}
            <Card title="Supervisor Roster" description="Supervisors eligible to be assigned to students at this company">
              <View className="gap-2">
                {roster.length ? (
                  roster.map((supervisor) => (
                    <RosterRow
                      key={supervisor.id}
                      supervisor={supervisor}
                      canRemove={company.can_manage_roster}
                      removing={removingId === supervisor.id}
                      disabled={busy}
                      onRemove={() => confirmDetach(company, supervisor)}
                    />
                  ))
                ) : (
                  <Text className="text-sm text-gray-500">No supervisors on this company&apos;s roster yet.</Text>
                )}
              </View>
              {company.can_manage_roster ? (
                <Button
                  label="Add Supervisor"
                  icon="person-add-outline"
                  variant="outline"
                  onPress={() => {
                    if (!inFlight.current) setPicking(true);
                  }}
                  loading={attach.isPending}
                  loadingLabel="Adding…"
                  disabled={busy}
                  className="mt-3"
                />
              ) : null}
            </Card>

            {company.can_delete || company.delete_blocked_reason ? (
              <View className="gap-2 pt-2">
                <Button
                  label="Delete Company"
                  icon="trash-outline"
                  variant="danger"
                  onPress={() => confirmDelete(company)}
                  disabled={!company.can_delete || busy}
                  loading={remove.isPending}
                  loadingLabel="Deleting…"
                />
                {!company.can_delete && company.delete_blocked_reason ? (
                  <Text className="px-1 text-xs text-gray-500">{DELETE_BLOCKED[company.delete_blocked_reason]}</Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : query.isError ? (
          <ErrorState message={apiError?.message ?? ''} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : (
          <DetailSkeleton />
        )}
      </ScrollView>

      {showActions ? (
        <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          {company.can_toggle_status ? (
            <Button
              label={isActive ? 'Deactivate' : 'Activate'}
              icon={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
              variant={isActive ? 'danger' : 'outline'}
              onPress={() => confirmToggle(company)}
              loading={setActive.isPending}
              loadingLabel={isActive ? 'Deactivating…' : 'Activating…'}
              disabled={busy && !setActive.isPending}
              className="flex-1"
            />
          ) : null}
          {company.can_edit ? <Button label="Edit" icon="create-outline" onPress={openEdit} disabled={busy} className="flex-1" /> : null}
        </View>
      ) : null}

      {company?.can_manage_roster ? (
        <SupervisorPickerSheet
          visible={picking}
          companyId={company.id}
          rosterIds={rosterIds}
          onPick={(supervisor) => pick(company, supervisor)}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </View>
  );
}
