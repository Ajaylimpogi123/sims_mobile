import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { assignmentFromLists, useAssignment, useSetStudentActive } from '@/api/assignments';
import { toApiError } from '@/api/errors';
import type { AssignmentStudent } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { setAssignmentsFlash, STUDENT_NOT_FOUND, takeAssignmentDetailFlash } from './flash';
import { SUPERVISOR_HINTS, SupervisorFlag, supervisorProblem } from './SupervisorFlag';
import { Text } from '@/components/ui/Text';

const TITLE = 'Student';

/** A label / value row, like the website form's Label above its value. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-0.5 py-2">
      <Text className="text-xs font-medium text-gray-500">{label}</Text>
      {children}
    </View>
  );
}

function Value({ text, muted = false, tabular = false }: { text: string; muted?: boolean; tabular?: boolean }) {
  return (
    <Text className={`text-base ${muted ? 'text-gray-500' : 'text-gray-900'}`} style={tabular ? TABULAR : undefined}>
      {text}
    </Text>
  );
}

function HeaderCard({ student }: { student: AssignmentStudent }) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <Text accessibilityRole="header" className="flex-1 text-xl font-semibold text-gray-900">
          {student.name ?? student.student_number}
        </Text>
        <StatusBadge status={student.status} />
      </View>
      <View className="mt-2 flex-row items-center gap-2">
        <Ionicons name="mail-outline" size={16} color={colors.gray500} />
        <Text className="flex-1 text-sm text-gray-600">{student.email ?? '-'}</Text>
      </View>
    </Card>
  );
}

function ProfileCard({ student }: { student: AssignmentStudent }) {
  return (
    <Card title="Profile">
      <Row label="Student Number">
        <Value text={student.student_number || '-'} tabular />
      </Row>
      <View className="flex-row gap-4">
        <View className="flex-1">
          <Row label="Course">
            <Value text={student.course || '-'} />
          </Row>
        </View>
        <View className="flex-1">
          <Row label="Section">
            <Value text={student.section || '-'} />
          </Row>
        </View>
      </View>
    </Card>
  );
}

function AssignmentCard({ student }: { student: AssignmentStudent }) {
  const problem = supervisorProblem(student);
  return (
    <Card title="Internship Assignment">
      <Row label="Company">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Value text={student.company?.company_name ?? 'Unassigned'} muted={!student.company} />
          </View>
          {student.company?.status === 'inactive' ? <StatusBadge status="inactive" /> : null}
        </View>
      </Row>
      <Row label="Supervisor">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Value text={student.supervisor?.name ?? 'Unassigned'} muted={!student.supervisor} />
          </View>
          {/* The "Supervisor inactive" flag already says it; no second Inactive badge then. */}
          {student.supervisor?.status === 'inactive' && problem !== 'inactive' ? <StatusBadge status="inactive" /> : null}
          <SupervisorFlag student={student} />
        </View>
        {problem === 'off_roster' ? (
          <Text className="text-xs text-amber-700">No longer on this company&apos;s roster. The assignment stays until you change it.</Text>
        ) : problem ? (
          <Text className="text-xs text-amber-700">{SUPERVISOR_HINTS[problem]}</Text>
        ) : null}
      </Row>
      <Row label="Internship Status">
        <StatusBadge status={student.internship_status} />
      </Row>
      <Row label="Internship Schedule">
        <Value text={student.internship_schedule || 'Not set'} muted={!student.internship_schedule} />
      </Row>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <SkeletonPulse label="Loading student">
      <View className="gap-3">
        <View className="gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-6 w-1/2" />
          <SkeletonBlock className="h-4 w-2/3" />
        </View>
        <View className="gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-5 w-1/3" />
          <SkeletonBlock className="h-4 w-1/2" />
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-4 w-1/3" />
        </View>
      </View>
    </SkeletonPulse>
  );
}

/**
 * One student (website: an Internship Assignment row with its Edit / Activate / Deactivate
 * actions). Buttons follow the API's can_edit / can_toggle_status; the server enforces every rule.
 */
export function AssignmentDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const [initial] = useState(() => (id === null ? undefined : assignmentFromLists(queryClient, id)));
  const query = useAssignment(id);
  const setActive = useSetStudentActive();
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const inFlight = useRef(false);
  const lastOpen = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const message = takeAssignmentDetailFlash();
      if (message) {
        setFlash(message);
        setProblem(null);
      }
    }, []),
  );

  const apiError = query.isError ? toApiError(query.error) : null;
  const gone = id === null || apiError?.kind === 'not_found';
  const student = gone ? undefined : (query.data ?? initial);

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
        <EmptyState icon="alert-circle-outline" message={STUDENT_NOT_FOUND} />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  const toggle = async (target: AssignmentStudent, active: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFlash(null);
    setProblem(null);
    try {
      const response = await setActive.mutateAsync({ id: target.id, active });
      setFlash(response.message);
      setAssignmentsFlash(response.message);
    } catch (error) {
      const failure = toApiError(error);
      setProblem(failure.kind === 'not_found' ? STUDENT_NOT_FOUND : (failure.fieldErrors.status ?? failure.message));
    } finally {
      inFlight.current = false;
    }
  };

  const confirmToggle = (target: AssignmentStudent) => {
    const isActive = target.status !== 'inactive';
    Alert.alert(
      isActive ? 'Deactivate Account?' : 'Activate Account?',
      isActive
        ? `Deactivate "${target.name ?? target.student_number}"? They will no longer be able to log in, and they will be signed out of the mobile app.`
        : `Reactivate "${target.name ?? target.student_number}"? They will be able to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isActive ? 'Deactivate' : 'Activate', style: isActive ? 'destructive' : 'default', onPress: () => void toggle(target, !isActive) },
      ],
    );
  };

  const openEdit = () => {
    const now = Date.now();
    if (!student || now - lastOpen.current < 1000) return;
    lastOpen.current = now;
    setFlash(null);
    setProblem(null);
    router.push({ pathname: '/assignment-form', params: { id: String(student.id) } });
  };

  const isActive = student?.status !== 'inactive';
  const showActions = !!student && (student.can_edit || student.can_toggle_status);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: TITLE }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 p-4"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
        {flash ? <Banner tone="success" message={flash} /> : null}
        {problem ? <Banner tone="error" message={problem} /> : null}
        {student && query.isError ? <Banner tone="warning" message={`Showing saved data. ${apiError?.message ?? ''}`.trim()} /> : null}
        {student ? (
          <>
            <HeaderCard student={student} />
            {!isActive ? (
              <Text className="px-1 text-sm text-gray-600">This account is deactivated and can&apos;t log in to the website or the app.</Text>
            ) : null}
            <AssignmentCard student={student} />
            <ProfileCard student={student} />
          </>
        ) : query.isError ? (
          <ErrorState message={apiError?.message ?? ''} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : (
          <DetailSkeleton />
        )}
      </ScrollView>

      {showActions ? (
        <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          {student.can_toggle_status ? (
            <Button
              label={isActive ? 'Deactivate' : 'Activate'}
              icon={isActive ? 'person-remove-outline' : 'person-add-outline'}
              variant={isActive ? 'danger' : 'outline'}
              onPress={() => confirmToggle(student)}
              loading={setActive.isPending}
              loadingLabel={isActive ? 'Deactivating…' : 'Activating…'}
              className="flex-1"
            />
          ) : null}
          {student.can_edit ? (
            <Button label="Edit" icon="create-outline" onPress={openEdit} disabled={setActive.isPending} className="flex-1" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
