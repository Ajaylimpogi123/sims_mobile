import Ionicons from '@expo/vector-icons/Ionicons';
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
import type { AssignmentCompanyOption, AssignmentOptions, AssignmentStudent, InternshipStatus, SupervisorIssue } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PickerField } from '@/components/ui/PickerField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectSheet, type SelectOption } from '@/components/ui/SelectSheet';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { REQUIRED_HOURS_MAX_LENGTH, requiredHoursError } from '@/lib/requiredHours';
import { isPastTerm, termStatusLabel } from '@/terms/selected-term';
import { useTermScope } from '@/terms/useTermScope';
import { colors } from '@/theme/colors';

import { INTERNSHIP_STATUSES } from './AssignmentsScreen';
import { setAssignmentDetailFlash, setAssignmentsFlash, STUDENT_NOT_FOUND } from './flash';
import { STUDENT_SUPERVISOR_HINTS, SUPERVISOR_ISSUE_SUFFIX } from './SupervisorFlag';
import { Text, TextInput } from '@/components/ui/Text';

type Field = keyof AssignmentInput;
const FIELDS: Field[] = [
  'name',
  'email',
  'student_number',
  'course',
  'section',
  'term_id',
  'company_id',
  'required_hours',
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

/** Website wording (StudentModal), also the server's 422 required_hours_missing message. */
const REQUIRED_HOURS_FOR_ONGOING_HINT = 'Set the required hours before marking the internship Ongoing.';

/** Website wording, also the server's 422 required_hours_locked message. */
const REQUIRED_HOURS_LOCKED_HINT = "Required hours can't be cleared while the internship is Ongoing.";

/** The form's text for a student's required hours: '' when not set (0 means not set, as on the server). */
function requiredHoursText(hours: number | null | undefined): string | undefined {
  if (hours === undefined) return undefined; // older server: the field isn't shown or sent
  return hours !== null && hours > 0 ? String(hours) : '';
}

/** Website wording (StudentModal), also the server's 422 term_id message. */
const TERM_LOCKED_HINT = "Only students who haven't started can move to another term.";

/** The server's 422 term_id message for a non-Administrator picking a past term. */
const PAST_TERM_HINT = 'Only an Administrator can move a student into a past term.';

/** 422 refusal codes whose message belongs to a picker; the options are refreshed so the counts match. */
const OPTION_CODES: Record<string, 'company_id'> = {
  company_inactive: 'company_id',
  company_full: 'company_id',
};

/** Website company option text: "Acme Corp (2/5)". */
function slotCount(company: Pick<AssignmentCompanyOption, 'students_count' | 'slots'>) {
  return `${company.students_count ?? 0}/${company.slots}`;
}

/** The website's amber field hint with a warning icon (a warning only: the server decides). */
function AmberHint({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-1.5" accessibilityRole="alert">
      <Ionicons name="warning-outline" size={14} color={colors.amber600} style={{ marginTop: 1 }} />
      <Text className="flex-1 text-xs text-amber-700">{text}</Text>
    </View>
  );
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
 * and Internship Assignment (Company with its supervisor read-only, Required Hours, Internship Status,
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
    internship_status: student.internship_status ?? 'not_started',
    internship_schedule: student.internship_schedule ?? '',
    required_hours: requiredHoursText(student.required_hours),
    // Undefined on an older server: the Term field isn't shown or sent.
    term_id: student.term_id ?? student.term?.id,
  }));
  const [values, setValues] = useState<AssignmentInput>(start);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState<'company' | 'term' | null>(null);
  const { terms, isAdmin } = useTermScope();
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
  const statuses = options.internship_statuses.length > 0 ? options.internship_statuses : INTERNSHIP_STATUSES;

  // The student's supervisor is always the company's supervisor (set in Company Management); the server
  // assigns it on save. Shown read-only. supervisor_issue only describes the student's saved company; for
  // another company only the account status is known here (website StudentModal, same order).
  const companySupervisor = selectedCompany?.supervisor ?? null;
  const keepsCurrentCompany = selectedCompany !== null && selectedCompany.id === start.company_id;
  // The server's own reason for each company (GET /assignments/options supervisor_issue) wins; the
  // fallback below is for an older server without it.
  const supervisorIssue: SupervisorIssue | null = !selectedCompany
    ? null
    : selectedCompany.supervisor_issue !== undefined
      ? selectedCompany.supervisor_issue
      : !companySupervisor
      ? 'no_supervisor'
      : keepsCurrentCompany && student.supervisor_issue === 'not_a_supervisor'
        ? 'not_a_supervisor'
        : companySupervisor.status !== 'active'
          ? 'inactive'
          : null;
  const supervisorSuffix = supervisorIssue ? SUPERVISOR_ISSUE_SUFFIX[supervisorIssue] : undefined;

  // New picks follow the server's rules: an active company with a free slot. The student's current company
  // always stays selectable. Like the website, inactive companies are hidden unless current ("(inactive)").
  const companyOptions: SelectOption[] = companies
    .filter((company) => company.status === 'active' || company.id === start.company_id)
    .map((company) => {
      const current = company.id === start.company_id;
      const full = !current && company.slots_available <= 0;
      return {
        value: company.id,
        label: company.status === 'active' ? company.company_name : `${company.company_name} (inactive)`,
        meta: slotCount(company),
        hint: [company.supervisor?.name, current ? 'Current company' : full ? 'No available slots' : null].filter(Boolean).join(' · ') || undefined,
        disabled: full,
      };
    });

  // Only a Not Started student (as saved) can move to another term, and only an Administrator into a
  // past term; the server enforces both (422 on term_id). The student's own term stays listed and selectable.
  const canChangeTerm = student.internship_status === 'not_started';
  const termOptions: SelectOption[] = useMemo(() => {
    const own = student.term;
    const option = (term: { id: number; label: string; is_current: boolean; is_past?: boolean }): SelectOption => {
      const blocked = !isAdmin && isPastTerm(term) && term.id !== own?.id;
      return {
        value: term.id,
        label: term.label,
        meta: termStatusLabel(term),
        hint: blocked ? PAST_TERM_HINT : undefined,
        disabled: blocked,
      };
    };
    const list = terms.map(option);
    return own && !list.some((item) => item.value === own.id) ? [option(own), ...list] : list;
  }, [terms, student.term, isAdmin]);
  const selectedTerm = termOptions.find((option) => option.value === values.term_id) ?? null;

  // The server refuses moving a student INTO Ongoing without required hours (empty or 0, checked against the
  // value sent in the same save; 422 on internship_status). Keeping an already-Ongoing status unchanged is
  // allowed, so no hint then.
  const hoursSet =
    values.required_hours !== undefined ? Number(values.required_hours.trim() || 0) > 0 : (student.required_hours ?? 0) > 0;
  const needsRequiredHoursForOngoing = values.internship_status === 'ongoing' && student.internship_status !== 'ongoing' && !hoursSet;
  // ...and refuses clearing the hours of a student who is Ongoing with hours set and stays Ongoing.
  const clearingLockedHours =
    values.required_hours !== undefined &&
    student.internship_status === 'ongoing' &&
    (student.required_hours ?? 0) > 0 &&
    values.internship_status === 'ongoing' &&
    !hoursSet;

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

  /** The supervisor follows the company on the server; nothing else to reset here. */
  const changeCompany = (companyId: number | null) => set('company_id', companyId);

  const validate = () => {
    const found: Partial<Record<Field, string>> = {};
    for (const [field, message] of Object.entries(REQUIRED) as [Field, string][]) {
      if (!String(values[field] ?? '').trim()) found[field] = message;
    }
    const hoursError = values.required_hours !== undefined ? requiredHoursError(values.required_hours) : null;
    if (hoursError) found.required_hours = hoursError;
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
        <Text className="text-sm text-gray-600">Update the student&apos;s profile, company assignment, required hours and internship status</Text>
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
          {values.term_id !== undefined ? (
            <View className="gap-1">
              <PickerField
                label="Term"
                icon="calendar-outline"
                value={selectedTerm ? `${selectedTerm.label} (${selectedTerm.meta})` : null}
                placeholder="Select a term"
                onPress={() => setPicker('term')}
                disabled={submitting || !canChangeTerm}
                error={errors.term_id}
              />
              {!canChangeTerm && !errors.term_id ? <Text className="text-xs text-gray-500">{TERM_LOCKED_HINT}</Text> : null}
            </View>
          ) : null}
          <View className="gap-1.5">
            <PickerField
              label="Company"
              icon="business-outline"
              value={selectedCompany ? `${selectedCompany.company_name}${selectedCompany.status === 'inactive' ? ' (inactive)' : ''}` : values.company_id === null ? 'Unassigned' : null}
              placeholder="Select a company"
              detail={selectedCompany ? `${slotCount(selectedCompany)} slots filled` : null}
              onPress={() => setPicker('company')}
              disabled={submitting}
              error={errors.company_id}
            />
            {/* Website: "Supervisor: <name>" read-only under Company (set on the company in Company Management). */}
            {companySupervisor ? (
              <Text className="text-sm text-gray-600" accessibilityLabel={`Supervisor: ${companySupervisor.name}${supervisorSuffix ? `, ${supervisorSuffix}` : ''}`}>
                Supervisor: <Text className="font-medium text-gray-900">{companySupervisor.name}</Text>
                {supervisorSuffix ? ` (${supervisorSuffix})` : ''}
              </Text>
            ) : null}
            {supervisorIssue ? <AmberHint text={STUDENT_SUPERVISOR_HINTS[supervisorIssue]} /> : null}
          </View>
          {values.required_hours !== undefined ? (
            <View className="gap-1">
              <TextField
                label="Required Hours"
                placeholder="e.g. 486"
                value={values.required_hours}
                onChangeText={(text) => {
                  set('required_hours', text);
                  // The Ongoing refusal sits under Internship Status; typing the hours answers it.
                  clear('internship_status');
                }}
                keyboardType="number-pad"
                maxLength={REQUIRED_HOURS_MAX_LENGTH}
                returnKeyType="done"
                editable={!submitting}
                error={errors.required_hours}
              />
              {clearingLockedHours && !errors.required_hours ? <AmberHint text={REQUIRED_HOURS_LOCKED_HINT} /> : null}
            </View>
          ) : null}
          <View className="gap-1">
            <SegmentedControl<InternshipStatus>
              label="Internship Status"
              options={statuses}
              value={values.internship_status}
              onChange={(value) => set('internship_status', value)}
              disabled={submitting}
              error={errors.internship_status}
            />
            {/* A warning only: the server decides (its 422 shows under the field instead). */}
            {needsRequiredHoursForOngoing && !errors.internship_status ? <AmberHint text={REQUIRED_HOURS_FOR_ONGOING_HINT} /> : null}
          </View>
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
        visible={picker === 'term'}
        title="Term"
        options={termOptions}
        selected={values.term_id ?? null}
        onSelect={(value) => {
          if (value !== null) set('term_id', value);
        }}
        onClose={() => setPicker(null)}
        emptyText="No terms yet"
      />
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
    </KeyboardAvoidingView>
  );
}
