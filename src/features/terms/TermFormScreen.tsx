import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/errors';
import { SCHOOL_YEAR_MAX, SCHOOL_YEAR_MIN, SEMESTERS, termFromList, useCreateTerm, useUpdateTerm, type TermInput } from '@/api/terms';
import type { Semester, Term } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';

import { setTermsFlash } from './flash';
import { schoolYearLabel } from './TermsScreen';

type Field = keyof TermInput;
const FIELDS: Field[] = ['school_year_start', 'semester', 'starts_on', 'ends_on'];

const GONE = 'That term no longer exists. Go back to see the current list.';

/** Laravel's wording for the same rules (the server's message wins when it answers). */
const RULES = {
  yearRequired: 'The school year start field is required.',
  yearRange: `The school year start field must be between ${SCHOOL_YEAR_MIN} and ${SCHOOL_YEAR_MAX}.`,
  endsAfter: 'The ends on field must be a date after or equal to starts on.',
} as const;

/** The website's default (useAddTerm): Jan–May still belongs to last year's school year. */
function defaultSchoolYearStart(today = new Date()): number {
  const year = today.getFullYear();
  return today.getMonth() < 5 ? year - 1 : year;
}

/**
 * Add / Edit Term (website: Terms AddModal / EditModal + TermFormFields): School Year (starting
 * year), Semester, Starts on / Ends on (optional). 422 errors show under the fields; a duplicate
 * school year + semester comes back on School Year.
 */
export function TermFormScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = params.id !== undefined;
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;

  const [term] = useState<Term | null>(() => (id === null ? null : (termFromList(queryClient, id) ?? null)));
  const [start] = useState<TermInput>(() => ({
    school_year_start: String(term?.school_year_start ?? defaultSchoolYearStart()),
    semester: term?.semester ?? 'first',
    starts_on: term?.starts_on ?? '',
    ends_on: term?.ends_on ?? '',
  }));
  const [values, setValues] = useState<TermInput>(start);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const saved = useRef(false);

  const create = useCreateTerm();
  const update = useUpdateTerm();

  const title = editing ? 'Edit Term' : 'Add Term';
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
        Alert.alert('Discard changes?', editing ? 'Your changes to this term will be lost.' : 'This term will not be added.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
        ]);
      }),
    [navigation, editing],
  );

  if (editing && !term) {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title }} />
        <EmptyState icon="alert-circle-outline" message={GONE} />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  const set = <K extends Field>(field: K, value: TermInput[K]) => {
    setValues((old) => ({ ...old, [field]: value }));
    setErrors((old) => (old[field] ? { ...old, [field]: undefined } : old));
  };

  const validate = () => {
    const found: Partial<Record<Field, string>> = {};
    const year = values.school_year_start.trim();
    if (!year) found.school_year_start = RULES.yearRequired;
    else if (/^\d+$/.test(year) && (Number(year) < SCHOOL_YEAR_MIN || Number(year) > SCHOOL_YEAR_MAX)) found.school_year_start = RULES.yearRange;
    if (values.starts_on && values.ends_on && values.ends_on < values.starts_on) found.ends_on = RULES.endsAfter;
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = async () => {
    if (inFlight.current || !validate()) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const response = term ? await update.mutateAsync({ id: term.id, input: values }) : await create.mutateAsync(values);
      saved.current = true;
      setTermsFlash(response.message);
      inFlight.current = false;
      router.back();
    } catch (error) {
      const apiError = toApiError(error);
      const fields: Partial<Record<Field, string>> = {};
      for (const field of FIELDS) {
        if (apiError.fieldErrors[field]) fields[field] = apiError.fieldErrors[field];
      }
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(apiError.kind === 'not_found' ? GONE : apiError.message);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const syLabel = schoolYearLabel(values.school_year_start.trim());

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title }} />
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm text-gray-600">{term ? term.label : "A new term isn't current until you set it as current."}</Text>
        {formError ? <Banner tone="error" message={formError} /> : null}
        <View className="gap-1">
          <TextField
            label="School Year (starting year)"
            value={values.school_year_start}
            onChangeText={(text) => set('school_year_start', text.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            maxLength={4}
            editable={!submitting}
            error={errors.school_year_start}
          />
          {!errors.school_year_start ? (
            <Text className="text-xs text-gray-500">{syLabel ?? 'Enter the year the school year starts'}</Text>
          ) : null}
        </View>
        <SegmentedControl<Semester>
          label="Semester"
          options={SEMESTERS}
          value={values.semester}
          onChange={(value) => set('semester', value)}
          disabled={submitting}
          error={errors.semester}
        />
        <View className="flex-row gap-3">
          <DateField
            label="Starts on (optional)"
            value={values.starts_on || null}
            onChange={(value) => set('starts_on', value ?? '')}
            placeholder="Not set"
            error={errors.starts_on}
          />
          <DateField
            label="Ends on (optional)"
            value={values.ends_on || null}
            onChange={(value) => set('ends_on', value ?? '')}
            placeholder="Not set"
            minimumDate={values.starts_on || null}
            error={errors.ends_on}
          />
        </View>
      </ScrollView>
      <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button label="Cancel" variant="outline" onPress={() => router.back()} disabled={submitting} className="flex-1" />
        <Button label={editing ? 'Save' : 'Add Term'} onPress={() => void submit()} loading={submitting} loadingLabel="Saving…" className="flex-1" />
      </View>
    </KeyboardAvoidingView>
  );
}
