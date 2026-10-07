import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ASSIGNMENT_STUDENT_NUMBER_MAX,
  ASSIGNMENT_TEXT_MAX,
  assignmentFromLists,
  assignmentKeys,
  useAssignment,
  useAssignmentOptions,
  useUpdateAssignment,
  type AssignmentInput,
} from '@/api/assignments';
import { toApiError } from '@/api/errors';
import type { AssignmentCompanyOption, AssignmentOptions, AssignmentStudent, InternshipStatus } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PickerField } from '@/components/ui/PickerField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectSheet, type SelectOption } from '@/components/ui/SelectSheet';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';

import { INTERNSHIP_STATUSES } from './AssignmentsScreen';
import { setAssignmentDetailFlash, setAssignmentsFlash, STUDENT_NOT_FOUND } from './flash';
import { Text, TextInput } from '@/components/ui/Text';

type Field = keyof AssignmentInput;
const FIELDS: Field[] = [
  'name',
  'email',
  'student_number',
  'course',
  'section',
  'company_id',
  'supervisor_id',
  'internship_status',
  'internship_schedule',
];

/** Laravel's wording for the same required rules (the server's message wins when it answers). */
const REQUIRED: Partial<Record<Field, string>> = {
  name: 'The name field is required.',
  email: 'The email field is required.',
  student_number: 'The student number field is required.',
  course: 'The course field is required.',
  section: 'The section field is required.',
};

/** 422 refusal codes whose message belongs to a picker; the options are refreshed so the counts match. */
const OPTION_CODES: Record<string, 'company_id' | 'supervisor_id'> = {
  company_inactive: 'company_id',
  company_full: 'company_id',
  supervisor_needs_company: 'supervisor_id',
  supervisor_not_on_roster: 'supervisor_id',
  supervisor_inactive: 'supervisor_id',
};

/** Website company option text: "Acme Corp (2/5)". */
function slotCount(company: Pick<AssignmentCompanyOption, 'students_count' | 'slots'>) {
  return `${company.students_count ?? 0}/${company.slots}`;
}

function FormSkeleton() {
  return (
    <SkeletonPulse label="Loading form">
      <View className="gap-5 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} className="gap-2">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-12 w-full rounded-md" />
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

// ---------------------------------------------------------------------------
// Screen: loads the student and the company options, then mounts the form
// ---------------------------------------------------------------------------

/**
 * Edit student (website: StudentModal): Profile (Name, Email, Student Number, Course, Section)
 * and Internship Assignment (Company, Supervisor from that company's roster, Internship Status,
 * Internship Schedule), in the website's order.
 */
export function AssignmentFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;

  const [cached] = useState<AssignmentStudent | undefined>(() =>
    id === null ? undefined : (queryClient.getQueryData<AssignmentStudent>(assignmentKeys.detail(id)) ?? assignmentFromLists(queryClient, id)),
  );
  const studentQuery = useAssignment(id);
  const options = useAssignmentOptions();

  const error = studentQuery.isError ? toApiError(studentQuery.error) : null;
  const student = studentQuery.data ?? cached;
  const title = student?.name || 'Edit Student';

  if (id === null || error?.kind === 'not_found') {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title: 'Edit Student' }} />
        <EmptyState icon="alert-circle-outline" message={STUDENT_NOT_FOUND} />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }
  if (!student || !options.data) {
    const failure = error ?? (options.isError ? toApiError(options.error) : null);
    return (
      <View className="flex-1 bg-gray-50">
        <Stack.Screen options={{ title }} />
        {failure ? (
          <View className="p-4">
            <ErrorState
              message={failure.message}
              onRetry={() => {
                if (!student) void studentQuery.refetch();
                if (!options.data) void options.refetch();
              }}
              retrying={studentQuery.isFetching || options.isFetching}
            />
          </View>
        ) : (
          <FormSkeleton />
        )}
      </View>
    );
  }
  if (!student.can_edit) {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title }} />
        <EmptyState icon="lock-closed-outline" message="You can't edit this student." />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }
  return <AssignmentForm key={student.id} title={title} student={student} options={options.data} onRefreshOptions={() => void options.refetch()} />;
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

interface FormProps {
  title: string;
  student: AssignmentStudent;
  options: AssignmentOptions;
  onRefreshOptions: () => void;
}

function AssignmentForm({ title, student, options, onRefreshOptions }: FormProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [start] = useState<AssignmentInput>(() => ({
    name: student.name ?? '',
    email: student.email ?? '',
    student_number: student.student_number ?? '',
    course: student.course ?? '',
    section: student.section ?? '',
    company_id: student.company?.id ?? null,
    supervisor_id: student.supervisor?.id ?? null,
    internship_status: student.internship_status ?? 'not_started',
    internship_schedule: student.internship_schedule ?? '',
  }));
  const [values, setValues] = useState<AssignmentInput>(start);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState<'company' | 'supervisor' | null>(null);
  const inFlight = useRef(false);
  const saved = useRef(false);
  const refs = {
    email: useRef<TextInput>(null),
    student_number: useRef<TextInput>(null),
    course: useRef<TextInput>(null),
    section: useRef<TextInput>(null),
  };

  const update = useUpdateAssignment();

  const dirty = JSON.stringify(values) !== JSON.stringify(start);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (inFlight.current) {
          event.preventDefault();
          return;
        }
        if (saved.current || !dirtyRef.current) return;
        event.preventDefault();
        Alert.alert('Discard changes?', 'Your changes to this student will be lost.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
        ]);
      }),
    [navigation],
  );

  const companies = options.companies;
  const selectedCompany = useMemo(() => companies.find((c) => c.id === values.company_id) ?? null, [companies, values.company_id]);
  // Active roster supervisors. The student's current supervisor, if inactive, is listed only for the student's
  // current company: after a company change the server refuses them (supervisor_inactive), so they're dropped.
  const rosterFor = (company: AssignmentCompanyOption | null | undefined) =>
    (company?.supervisors ?? []).filter(
      (s) => s.status === 'active' || (s.id === start.supervisor_id && company?.id === start.company_id),
    );
  const roster = rosterFor(selectedCompany);
  const statuses = options.internship_statuses.length > 0 ? options.internship_statuses : INTERNSHIP_STATUSES;

  // The student's own supervisor stays selectable while the company is unchanged, even if they
  // were later removed from its roster (the server keeps that assignment, like the website).
  const keptSupervisor =
    student.supervisor && values.company_id === start.company_id && !roster.some((s) => s.id === student.supervisor?.id)
      ? student.supervisor
      : null;
  const selectedSupervisor =
    roster.find((s) => s.id === values.supervisor_id) ?? (keptSupervisor && keptSupervisor.id === values.supervisor_id ? keptSupervisor : null);

  // New picks follow the server's rules: an active company with a free slot, an active supervisor, and no new
  // supervisor at an inactive company. The student's current company / supervisor always stay selectable.
  // Like the website, inactive companies are hidden unless current (then labelled "(inactive)").
  const companyOptions: SelectOption[] = companies
    .filter((company) => company.status === 'active' || company.id === start.company_id)
    .map((company) => {
      const current = company.id === start.company_id;
      const full = !current && company.slots_available <= 0;
      return {
        value: company.id,
        label: company.status === 'active' ? company.company_name : `${company.company_name} (inactive)`,
        meta: slotCount(company),
        hint: (current ? 'Current company' : full ? 'No available slots' : undefined),
        disabled: full,
      };
    });
  const companyInactive = selectedCompany?.status === 'inactive';
  const supervisorOptions: SelectOption[] = [
    ...roster.map((s) => {
      const current = s.id === start.supervisor_id;
      const inactive = s.status === 'inactive';
      return {
        value: s.id,
        label: inactive ? `${s.name} (inactive)` : s.name,
        hint: [s.email, current ? 'Current supervisor' : null].filter(Boolean).join(' · '),
        disabled: !current && companyInactive,
      };
    }),
    ...(keptSupervisor
      ? [{ value: keptSupervisor.id, label: keptSupervisor.name, hint: selectedCompany ? "Not on this company's roster" : 'Current supervisor' }]
      : []),
  ];

  // Without a company the picker only offers the student's existing supervisor (to keep or clear), as the
  // server accepts that unchanged value; otherwise it waits for a company like the website.
  const supervisorPickable = !!selectedCompany || keptSupervisor !== null;

  const clear = (...fields: Field[]) =>
    setErrors((old) => {
      if (!fields.some((f) => old[f])) return old;
      const next = { ...old };
      for (const f of fields) delete next[f];
      return next;
    });

  const set = <K extends Field>(field: K, value: AssignmentInput[K]) => {
    setValues((old) => ({ ...old, [field]: value }));
    clear(field);
  };

  /** Website handleCompanyChange: keep the supervisor only if they're on the new company's roster. */
  const changeCompany = (companyId: number | null) => {
    setValues((old) => {
      const company = companies.find((c) => c.id === companyId);
      const stillValid =
        old.supervisor_id !== null &&
        (rosterFor(company).some((s) => s.id === old.supervisor_id) ||
          (companyId === start.company_id && old.supervisor_id === start.supervisor_id));
      return { ...old, company_id: companyId, supervisor_id: stillValid ? old.supervisor_id : null };
    });
    clear('company_id', 'supervisor_id');
  };

  const validate = () => {
    const found: Partial<Record<Field, string>> = {};
    for (const [field, message] of Object.entries(REQUIRED) as [Field, string][]) {
      if (!String(values[field] ?? '').trim()) found[field] = message;
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = async () => {
    if (inFlight.current || !validate()) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const response = await update.mutateAsync({ id: student.id, input: values });
      saved.current = true;
      setAssignmentsFlash(response.message);
      setAssignmentDetailFlash(response.message);
      inFlight.current = false;
      router.back();
    } catch (error) {
      const apiError = toApiError(error);
      const fields: Partial<Record<Field, string>> = {};
      for (const field of FIELDS) {
        if (apiError.fieldErrors[field]) fields[field] = apiError.fieldErrors[field];
      }
      const codeField = apiError.code ? OPTION_CODES[apiError.code] : undefined;
      if (codeField) {
        // e.g. "Acme Corp has no available slots (5/5 filled)." — show it on its picker and refresh the counts / statuses.
        if (!fields[codeField]) fields[codeField] = apiError.message;
        onRefreshOptions();
      }
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(apiError.kind === 'not_found' ? STUDENT_NOT_FOUND : apiError.message);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const next = (field: keyof typeof refs) => () => refs[field].current?.focus();

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title }} />
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm text-gray-600">Update the student&apos;s profile, company/supervisor assignment, and internship status</Text>
        {formError ? <Banner tone="error" message={formError} /> : null}

        <Text accessibilityRole="header" className="text-sm font-semibold text-gray-500">
          Profile
        </Text>
        <TextField
          label="Name"
          value={values.name}
          onChangeText={(text) => set('name', text)}
          autoCapitalize="words"
          autoComplete="name"
          maxLength={ASSIGNMENT_TEXT_MAX}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={next('email')}
          editable={!submitting}
          error={errors.name}
        />
        <TextField
          ref={refs.email}
          label="Email"
          value={values.email}
          // The server requires lowercase, like the website's rule.
          onChangeText={(text) => set('email', text.toLowerCase())}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={ASSIGNMENT_TEXT_MAX}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={next('student_number')}
          editable={!submitting}
          error={errors.email}
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <TextField
              ref={refs.student_number}
              label="Student Number"
              value={values.student_number}
              onChangeText={(text) => set('student_number', text)}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={ASSIGNMENT_STUDENT_NUMBER_MAX}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={next('course')}
              editable={!submitting}
              error={errors.student_number}
            />
          </View>
          <View className="flex-1">
            <TextField
              ref={refs.course}
              label="Course"
              value={values.course}
              onChangeText={(text) => set('course', text)}
              autoCapitalize="characters"
              maxLength={ASSIGNMENT_TEXT_MAX}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={next('section')}
              editable={!submitting}
              error={errors.course}
            />
          </View>
        </View>
        <TextField
          ref={refs.section}
          label="Section"
          value={values.section}
          onChangeText={(text) => set('section', text)}
          autoCapitalize="characters"
          maxLength={ASSIGNMENT_TEXT_MAX}
          returnKeyType="done"
          editable={!submitting}
          error={errors.section}
        />

        <View className="gap-5 border-t border-gray-200 pt-5">
          <Text accessibilityRole="header" className="text-sm font-semibold text-gray-500">
            Internship Assignment
          </Text>
          <PickerField
            label="Company"
            icon="business-outline"
            value={selectedCompany ? `${selectedCompany.company_name}${selectedCompany.status === 'inactive' ? ' (inactive)' : ''}` : values.company_id === null ? 'Unassigned' : null}
            placeholder="Select a company"
            detail={
              selectedCompany
                ? `${slotCount(selectedCompany)} slots filled`
                : null
            }
            onPress={() => setPicker('company')}
            disabled={submitting}
            error={errors.company_id}
          />
          <View className="gap-1">
            <PickerField
              label="Supervisor"
              icon="person-outline"
              value={supervisorPickable ? (selectedSupervisor ? `${selectedSupervisor.name}${selectedSupervisor.status === 'inactive' ? ' (inactive)' : ''}` : 'Unassigned') : null}
              placeholder={selectedCompany ? 'Select a supervisor' : 'Assign a company first'}
              detail={
                selectedSupervisor && keptSupervisor?.id === selectedSupervisor.id
                  ? selectedCompany
                    ? "Not on this company's roster"
                    : 'Kept from before; no company assigned'
                  : null
              }
              onPress={() => setPicker('supervisor')}
              disabled={submitting || !supervisorPickable}
              error={errors.supervisor_id}
            />
            {selectedCompany && roster.length === 0 ? (
              <Text className="text-xs text-gray-500">No active supervisors on this company&apos;s roster</Text>
            ) : companyInactive ? (
              <Text className="text-xs text-amber-700">This company is inactive. Activate it in Company Management before assigning a new supervisor.</Text>
            ) : null}
          </View>
          <SegmentedControl<InternshipStatus>
            label="Internship Status"
            options={statuses}
            value={values.internship_status}
            onChange={(value) => set('internship_status', value)}
            disabled={submitting}
            error={errors.internship_status}
          />
          <TextField
            label="Internship Schedule"
            placeholder="e.g. Mon-Fri, 8:00 AM - 5:00 PM"
            value={values.internship_schedule}
            onChangeText={(text) => set('internship_schedule', text)}
            maxLength={ASSIGNMENT_TEXT_MAX}
            returnKeyType="done"
            editable={!submitting}
            error={errors.internship_schedule}
          />
        </View>
      </ScrollView>
      <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button label="Cancel" variant="outline" onPress={() => router.back()} disabled={submitting} className="flex-1" />
        <Button label="Save" onPress={() => void submit()} loading={submitting} loadingLabel="Saving…" className="flex-1" />
      </View>

      <SelectSheet
        visible={picker === 'company'}
        title="Company"
        allLabel="Unassigned"
        options={companyOptions}
        selected={values.company_id}
        onSelect={changeCompany}
        onClose={() => setPicker(null)}
        emptyText="No companies yet"
      />
      <SelectSheet
        visible={picker === 'supervisor'}
        title="Supervisor"
        allLabel="Unassigned"
        options={supervisorOptions}
        selected={values.supervisor_id}
        onSelect={(value) => set('supervisor_id', value)}
        onClose={() => setPicker(null)}
        emptyText="No active supervisors on this company's roster"
      />
    </KeyboardAvoidingView>
  );
}
