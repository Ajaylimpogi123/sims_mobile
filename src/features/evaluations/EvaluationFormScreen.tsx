import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/errors';
import {
  EVALUATION_TEXT_MAX,
  evaluationRuleRefusal,
  RESPONSE_COMMENT_MAX,
  useCreateEvaluation,
  useEvaluableStudents,
  useEvaluation,
  useEvaluationAction,
  useEvaluationCriteria,
  useUpdateEvaluation,
  type EvaluationInput,
} from '@/api/evaluations';
import type { EvaluableStudent, EvaluationCriteriaResponse, EvaluationDetail, EvaluationResponseInput } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SelectSheet } from '@/components/ui/SelectSheet';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { EvaluationStatusBadge } from './EvaluationStatusBadge';
import { setEvaluationsFlash } from './flash';
import { responseErrorsByCriterion } from './format';
import { RatingPicker } from './RatingPicker';
import { Text } from '@/components/ui/Text';

/** Laravel's wording for the same rules, so a client-side check reads like the server's 422. */
const RULE_MESSAGES = {
  studentRequired: 'The student id field is required.',
  startRequired: 'The evaluation period start field is required.',
  endRequired: 'The evaluation period end field is required.',
  endAfterStart: 'The evaluation period end field must be a date after or equal to evaluation period start.',
  allRated: 'Every evaluation criterion must be rated before submitting.',
} as const;

const NOT_EDITABLE = 'Only draft evaluations can be edited.';
const GONE = "We couldn't find that evaluation. It may have been removed or reassigned.";

/** Website EvaluationFormFields TEXT_FIELDS. */
const TEXT_FIELDS = [
  { key: 'strengths', label: 'Strengths' },
  { key: 'areas_for_improvement', label: 'Areas for Improvement' },
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'supervisor_remarks', label: 'Supervisor Remarks' },
] as const;

type TextKey = (typeof TEXT_FIELDS)[number]['key'];
type FieldKey = 'student_id' | 'evaluation_period_start' | 'evaluation_period_end' | 'responses' | TextKey;

interface ResponseValue {
  rating: number | null;
  comment: string;
}

interface FormValues {
  studentId: number | null;
  start: string | null;
  end: string | null;
  text: Record<TextKey, string>;
  responses: Record<number, ResponseValue>;
}

/** Website lib/responses.js initResponses: every active criterion, prefilled from saved responses. */
function initValues(criteria: EvaluationCriteriaResponse, evaluation: EvaluationDetail | null): FormValues {
  const saved = new Map<number, EvaluationResponseInput>((evaluation?.responses ?? []).map((r) => [r.evaluation_criteria_id, r]));
  const responses: Record<number, ResponseValue> = {};
  for (const group of criteria.categories) {
    for (const criterion of group.criteria) {
      const prior = saved.get(criterion.id);
      responses[criterion.id] = { rating: prior?.rating ?? null, comment: prior?.comment ?? '' };
    }
  }
  return {
    studentId: evaluation?.student?.id ?? null,
    start: evaluation?.period_start ?? null,
    end: evaluation?.period_end ?? null,
    text: {
      strengths: evaluation?.strengths ?? '',
      areas_for_improvement: evaluation?.areas_for_improvement ?? '',
      recommendations: evaluation?.recommendations ?? '',
      supervisor_remarks: evaluation?.supervisor_remarks ?? '',
    },
    responses,
  };
}

/** Website toResponsesArray: rated criteria only. */
function toResponses(values: FormValues): EvaluationResponseInput[] {
  return Object.entries(values.responses)
    .filter(([, value]) => value.rating !== null)
    .map(([id, value]) => ({ evaluation_criteria_id: Number(id), rating: value.rating as number, comment: value.comment.trim() ? value.comment.trim() : null }));
}

/** Website computeAverageRating: average of the given ratings, 2 dp. */
function averageRating(values: FormValues): string {
  const ratings = Object.values(values.responses)
    .map((value) => value.rating)
    .filter((rating): rating is number => rating !== null);
  if (!ratings.length) return '—';
  return (Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 100) / 100).toFixed(2);
}

// ---------------------------------------------------------------------------
// Route: /evaluation-form (new) or /evaluation-form?id=7 (edit a draft)
// ---------------------------------------------------------------------------

export function EvaluationFormScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const editing = params.id !== undefined;
  const title = editing ? 'Edit Evaluation' : 'New Evaluation';

  const criteria = useEvaluationCriteria();
  const students = useEvaluableStudents(!editing);
  const evaluation = useEvaluation(id);
  // Once the form is up it stays up: a save / submit refreshes the evaluation (e.g. to submitted)
  // or a background refetch fails, and the form itself shows that, not this gate.
  const started = useRef(false);

  const failed =
    !started.current && ((editing && id === null) || (editing && evaluation.isError) || criteria.isError || (!editing && students.isError));
  if (failed) {
    const error = editing && id === null ? null : toApiError(editing && evaluation.isError ? evaluation.error : criteria.isError ? criteria.error : students.error);
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title }} />
        {error && error.kind !== 'not_found' ? (
          <ErrorState
            message={error.message}
            onRetry={() => {
              if (criteria.isError) void criteria.refetch();
              if (students.isError) void students.refetch();
              if (evaluation.isError) void evaluation.refetch();
            }}
          />
        ) : (
          <EmptyState icon="alert-circle-outline" message={GONE} />
        )}
      </View>
    );
  }

  const ready = criteria.data && (editing ? evaluation.data : students.data);
  if (!ready) {
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <Stack.Screen options={{ title }} />
        <SkeletonPulse label="Loading the evaluation form">
          <View className="gap-4">
            <SkeletonBlock className="h-12 w-full" />
            <View className="flex-row gap-3">
              <SkeletonBlock className="h-12 flex-1" />
              <SkeletonBlock className="h-12 flex-1" />
            </View>
            <SkeletonBlock className="h-40 w-full" />
          </View>
        </SkeletonPulse>
      </View>
    );
  }

  if (!started.current && editing && evaluation.data && !evaluation.data.can_edit) {
    return <NotEditable title={title} message={evaluation.data.status === 'draft' ? "You don't have permission to do that." : NOT_EDITABLE} />;
  }

  started.current = true;
  return (
    <EvaluationForm
      title={title}
      criteria={criteria.data!}
      students={students.data ?? []}
      evaluation={editing ? evaluation.data! : null}
    />
  );
}

function NotEditable({ title, message }: { title: string; message: string }) {
  const router = useRouter();
  return (
    <View className="flex-1 gap-3 bg-gray-50 p-4">
      <Stack.Screen options={{ title }} />
      <Banner tone="warning" message={message} />
      <Button label="Back" variant="outline" onPress={() => router.back()} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Form (website: EvaluationFormFields + CriteriaRatingGroup)
// ---------------------------------------------------------------------------

interface EvaluationFormProps {
  title: string;
  criteria: EvaluationCriteriaResponse;
  students: EvaluableStudent[];
  /** null = new evaluation. */
  evaluation: EvaluationDetail | null;
}

function EvaluationForm({ title, criteria, students, evaluation }: EvaluationFormProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [start] = useState<FormValues>(() => initValues(criteria, evaluation));
  const [values, setValues] = useState<FormValues>(start);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [criterionErrors, setCriterionErrors] = useState<Record<number, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null);
  /** The draft id once saved (a new evaluation saved but not yet submitted keeps it). */
  const [draftId, setDraftId] = useState<number | null>(evaluation?.id ?? null);
  /** Saved values, to know what's unsaved after a save whose submit failed. */
  const [savedValues, setSavedValues] = useState<FormValues>(start);
  /** Refused by the server (not a draft anymore): read-only, leave freely. */
  const [refused, setRefused] = useState(false);
  const inFlight = useRef(false);

  const create = useCreateEvaluation();
  const update = useUpdateEvaluation();
  const action = useEvaluationAction();

  const dirty = JSON.stringify(values) !== JSON.stringify(savedValues);
  const isNew = evaluation === null;
  const student = isNew ? students.find((s) => s.id === values.studentId) ?? null : null;
  const allCriteria = useMemo(() => criteria.categories.flatMap((group) => group.criteria), [criteria]);

  // Back / swipe: ask before throwing away unsaved changes; never leave mid-request.
  const leaving = useRef(false);
  const dirtyRef = useRef(dirty);
  const busyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty && !refused;
    busyRef.current = busy !== null;
  }, [dirty, refused, busy]);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (leaving.current) return;
        if (busyRef.current) {
          event.preventDefault();
          return;
        }
        if (!dirtyRef.current) return;
        event.preventDefault();
        Alert.alert('Discard changes?', isNew && draftId === null ? 'This evaluation will not be saved.' : 'Your changes to this evaluation will be lost.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
        ]);
      }),
    [navigation, isNew, draftId],
  );

  const clearError = (key: FieldKey) => setErrors((old) => (old[key] ? { ...old, [key]: undefined } : old));

  const setRating = (criterionId: number, rating: number) => {
    setValues((old) => ({ ...old, responses: { ...old.responses, [criterionId]: { ...old.responses[criterionId], rating } } }));
    setCriterionErrors((old) => (old[criterionId] ? { ...old, [criterionId]: '' } : old));
    clearError('responses');
  };
  const setComment = (criterionId: number, comment: string) => {
    setValues((old) => ({ ...old, responses: { ...old.responses, [criterionId]: { ...old.responses[criterionId], comment } } }));
    setCriterionErrors((old) => (old[criterionId] ? { ...old, [criterionId]: '' } : old));
  };

  const showProblem = (message: string) => {
    setBanner(message);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const validate = (forSubmit: boolean) => {
    const found: Partial<Record<FieldKey, string>> = {};
    const perCriterion: Record<number, string> = {};
    if (isNew && values.studentId === null) found.student_id = RULE_MESSAGES.studentRequired;
    if (!values.start) found.evaluation_period_start = RULE_MESSAGES.startRequired;
    if (!values.end) found.evaluation_period_end = RULE_MESSAGES.endRequired;
    else if (values.start && values.end < values.start) found.evaluation_period_end = RULE_MESSAGES.endAfterStart;
    if (forSubmit) {
      const unrated = allCriteria.filter((c) => values.responses[c.id]?.rating === null);
      if (unrated.length) {
        found.responses = RULE_MESSAGES.allRated;
        for (const c of unrated) perCriterion[c.id] = 'Not rated';
      }
    }
    return { found, perCriterion };
  };

  const finish = (message: string, id: number) => {
    leaving.current = true;
    setEvaluationsFlash(message);
    if (isNew) router.replace({ pathname: '/evaluation/[id]', params: { id: String(id) } });
    else router.back();
  };

  /** Maps a failed save / submit onto the form. */
  const handleError = (error: unknown, sent: EvaluationResponseInput[]) => {
    const apiError = toApiError(error);
    if (evaluationRuleRefusal(error)) {
      // Submitted / locked by someone else meanwhile; the detail already shows the fresh state.
      setRefused(true);
      showProblem(apiError.message);
      return;
    }
    if (apiError.kind === 'validation') {
      const fields: Partial<Record<FieldKey, string>> = {};
      for (const key of ['student_id', 'evaluation_period_start', 'evaluation_period_end', 'responses', ...TEXT_FIELDS.map((f) => f.key)] as FieldKey[]) {
        if (apiError.fieldErrors[key]) fields[key] = apiError.fieldErrors[key];
      }
      const perCriterion = responseErrorsByCriterion(apiError.fieldErrors, sent);
      setErrors(fields);
      setCriterionErrors(perCriterion);
      const anyMapped = Object.keys(fields).length > 0 || Object.keys(perCriterion).length > 0;
      showProblem(anyMapped ? 'Please check the highlighted fields.' : apiError.message);
      return;
    }
    if (apiError.kind === 'not_found') {
      setRefused(true);
      showProblem(GONE);
      return;
    }
    if (apiError.kind === 'forbidden') setRefused(true);
    showProblem(apiError.message);
  };

  const send = async (submitAfter: boolean) => {
    if (inFlight.current || refused) return;
    const { found, perCriterion } = validate(submitAfter);
    setErrors(found);
    setCriterionErrors(perCriterion);
    if (Object.keys(found).length > 0) {
      showProblem(found.responses && Object.keys(found).length === 1 ? found.responses : 'Please check the highlighted fields.');
      return;
    }

    inFlight.current = true;
    setBusy(submitAfter ? 'submit' : 'save');
    setBanner(null);
    const responses = toResponses(values);
    const input: EvaluationInput = {
      evaluation_period_start: values.start!,
      evaluation_period_end: values.end!,
      ...values.text,
      responses,
    };
    let id = draftId;
    let message: string | null = null;
    try {
      // Save first (the website's Submit sends the saved draft), unless nothing changed since the last save.
      if (id === null) {
        const created = await create.mutateAsync({ ...input, student_id: values.studentId! });
        id = created.evaluation.id;
        message = created.message;
        setDraftId(id);
        setSavedValues(values);
      } else if (dirty || !submitAfter) {
        const updated = await update.mutateAsync({ id, input });
        message = updated.message;
        setSavedValues(values);
      }
      if (submitAfter) {
        const submitted = await action.mutateAsync({ id, action: 'submit' });
        message = submitted.message;
      }
      finish(message ?? 'Evaluation draft updated.', id);
    } catch (error) {
      handleError(error, responses);
      // Saved, then the submit was refused (e.g. an unrated criterion): say the draft is saved.
      if (message && submitAfter) {
        setBanner((current) => `${message} ${current ?? ''}`.trim());
      }
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const submit = () => {
    if (inFlight.current || refused) return;
    const { found, perCriterion } = validate(true);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setCriterionErrors(perCriterion);
      showProblem(found.responses && Object.keys(found).length === 1 ? found.responses : 'Please check the highlighted fields.');
      return;
    }
    Alert.alert('Submit Evaluation?', 'Submit this evaluation? Once submitted it can no longer be edited unless an administrator reopens it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: () => void send(true) },
    ]);
  };

  const disabled = busy !== null || refused;

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title }} />
      <ScrollView ref={scrollRef} className="flex-1" contentContainerClassName="gap-5 p-4 pb-8" keyboardShouldPersistTaps="handled">
        {evaluation ? (
          <View className="gap-0.5">
            <View className="flex-row items-start justify-between gap-3">
              <Text accessibilityRole="header" className="flex-1 text-base font-semibold text-gray-900">
                {evaluation.student?.name ?? '—'}
              </Text>
              <EvaluationStatusBadge status={evaluation.status} />
            </View>
            <Text className="text-sm text-gray-500">
              {evaluation.company?.name || '—'} · Supervisor: {evaluation.supervisor?.name || '—'}
            </Text>
          </View>
        ) : null}
        {banner ? <Banner tone={refused ? 'warning' : 'error'} message={banner} /> : null}

        {isNew ? (
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700">Student</Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              disabled={disabled || draftId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Student: ${student ? student.name : 'Select a student'}`}
              accessibilityHint={errors.student_id ?? 'Opens the list of students'}
              className={`min-h-12 flex-row items-center gap-2 rounded-md border bg-white px-3 py-2 ${errors.student_id ? 'border-red-500' : 'border-gray-300'} ${draftId !== null ? 'opacity-60' : ''}`}>
              <Ionicons name="person-outline" size={18} color={colors.gray500} />
              <View className="flex-1">
                <Text className={`text-base ${student ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
                  {student ? `${student.name}${student.student_number ? ` (${student.student_number})` : ''}` : 'Select a student'}
                </Text>
                {student?.company ? (
                  <Text className="text-xs text-gray-500" numberOfLines={1}>
                    {student.company.name}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.gray500} />
            </Pressable>
            {errors.student_id ? <Text className="text-sm text-red-600">{errors.student_id}</Text> : null}
            {students.length === 0 ? <Text className="text-xs text-gray-500">You have no students to evaluate yet.</Text> : null}
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <DateField
            label="Evaluation Period Start"
            value={values.start}
            placeholder="Select a date"
            clearable={false}
            minimumDate="2000-01-01"
            onChange={(value) => {
              setValues((old) => ({ ...old, start: value }));
              clearError('evaluation_period_start');
              clearError('evaluation_period_end');
            }}
            error={errors.evaluation_period_start}
          />
          <DateField
            label="Evaluation Period End"
            value={values.end}
            placeholder="Select a date"
            clearable={false}
            minimumDate={values.start ?? '2000-01-01'}
            onChange={(value) => {
              setValues((old) => ({ ...old, end: value }));
              clearError('evaluation_period_end');
            }}
            error={errors.evaluation_period_end}
          />
        </View>

        <View
          className="flex-row items-baseline justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
          accessible
          accessibilityLabel={`Overall Rating, auto-computed from criteria ratings: ${averageRating(values)} out of ${criteria.rating_max}`}>
          <Text className="flex-1 text-sm text-gray-700">Overall Rating (auto-computed from criteria ratings)</Text>
          <Text className="text-sm text-gray-700" style={TABULAR}>
            <Text className="text-base font-semibold text-gray-900">{averageRating(values)}</Text>/{criteria.rating_max}
          </Text>
        </View>

        {criteria.categories.length === 0 ? (
          <Text className="text-sm text-gray-500">No evaluation criteria have been configured yet.</Text>
        ) : (
          criteria.categories.map((group) => (
            <View key={group.category} className="gap-2">
              <Text accessibilityRole="header" className="px-1 text-sm font-semibold text-gray-900">
                {group.category}
              </Text>
              <View className="rounded-xl border border-gray-200 bg-white px-4">
                {group.criteria.map((criterion, index) => {
                  const value = values.responses[criterion.id] ?? { rating: null, comment: '' };
                  return (
                    <View key={criterion.id} className={`gap-2 py-4 ${index > 0 ? 'border-t border-gray-200' : ''}`}>
                      <View className="gap-0.5">
                        <Text className="text-sm font-medium text-gray-900">{criterion.label}</Text>
                        {criterion.description ? <Text className="text-xs text-gray-500">{criterion.description}</Text> : null}
                      </View>
                      <RatingPicker
                        label={criterion.label}
                        value={value.rating}
                        disabled={disabled}
                        onChange={(rating) => setRating(criterion.id, rating)}
                        error={criterionErrors[criterion.id] || null}
                      />
                      <TextField
                        label={`Comment for ${criterion.label}`}
                        placeholder="Comment (optional)"
                        value={value.comment}
                        onChangeText={(text) => setComment(criterion.id, text)}
                        editable={!disabled}
                        multiline
                        maxLength={RESPONSE_COMMENT_MAX}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
        {errors.responses ? <Text className="text-sm text-red-600">{errors.responses}</Text> : null}

        {TEXT_FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            value={values.text[field.key]}
            onChangeText={(text) => {
              setValues((old) => ({ ...old, text: { ...old.text, [field.key]: text } }));
              clearError(field.key);
            }}
            editable={!disabled}
            multiline
            maxLength={EVALUATION_TEXT_MAX}
            error={errors[field.key]}
          />
        ))}
      </ScrollView>

      <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button
          label="Save Draft"
          variant="outline"
          onPress={() => void send(false)}
          loading={busy === 'save'}
          loadingLabel="Saving…"
          disabled={disabled}
          className="flex-1"
        />
        <Button label="Submit" onPress={submit} loading={busy === 'submit'} loadingLabel="Submitting…" disabled={disabled} className="flex-1" />
      </View>

      {isNew ? (
        <SelectSheet
          visible={pickerOpen}
          title="Select a student"
          allLabel="No student selected"
          options={students.map((s) => ({
            value: s.id,
            label: s.student_number ? `${s.name} (${s.student_number})` : s.name,
            hint: s.company?.name,
          }))}
          selected={values.studentId}
          onSelect={(value) => {
            setValues((old) => ({ ...old, studentId: value }));
            clearError('student_id');
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
