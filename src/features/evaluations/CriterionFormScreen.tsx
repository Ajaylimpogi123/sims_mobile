import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/errors';
import {
  CRITERION_DESCRIPTION_MAX,
  CRITERION_LABEL_MAX,
  evaluationKeys,
  useCreateCriterion,
  useUpdateCriterion,
  type CriterionInput,
} from '@/api/evaluations';
import type { ManagedCriterion } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TextField } from '@/components/ui/TextField';

import { setCriteriaFlash } from './flash';

type Field = keyof CriterionInput;

/** Laravel's wording for the same rules. */
const RULE_MESSAGES = {
  category: 'The category field is required.',
  label: 'The label field is required.',
  sortOrder: 'The sort order field must be an integer.',
} as const;

const GONE = 'That criterion no longer exists. Go back to see the current list.';

/**
 * Add / edit a criterion (website: EvaluationCriteria AddModal / EditModal): Category, Label,
 * Description (optional), Sort Order. 422 errors show under the fields.
 */
export function CriterionFormScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = params.id !== undefined;
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;

  const [criterion] = useState<ManagedCriterion | null>(() =>
    id === null ? null : (queryClient.getQueryData<ManagedCriterion[]>(evaluationKeys.managedCriteria) ?? []).find((c) => c.id === id) ?? null,
  );
  const [start] = useState<CriterionInput>(() => ({
    category: criterion?.category ?? '',
    label: criterion?.label ?? '',
    description: criterion?.description ?? '',
    sort_order: criterion ? String(criterion.sort_order) : '0',
  }));
  const [values, setValues] = useState<CriterionInput>(start);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const saved = useRef(false);

  const create = useCreateCriterion();
  const update = useUpdateCriterion();

  const title = editing ? 'Edit Evaluation Criterion' : 'Add Evaluation Criterion';
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
        Alert.alert('Discard changes?', editing ? 'Your changes to this criterion will be lost.' : 'This criterion will not be added.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
        ]);
      }),
    [navigation, editing],
  );

  if (editing && !criterion) {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title }} />
        <EmptyState icon="alert-circle-outline" message={GONE} />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  const set = (field: Field, value: string) => {
    setValues((old) => ({ ...old, [field]: value }));
    setErrors((old) => (old[field] ? { ...old, [field]: undefined } : old));
  };

  const submit = async () => {
    if (inFlight.current) return;
    const found: Partial<Record<Field, string>> = {};
    if (!values.category.trim()) found.category = RULE_MESSAGES.category;
    if (!values.label.trim()) found.label = RULE_MESSAGES.label;
    if (values.sort_order.trim() && !/^\d+$/.test(values.sort_order.trim())) found.sort_order = RULE_MESSAGES.sortOrder;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const response = criterion ? await update.mutateAsync({ id: criterion.id, input: values }) : await create.mutateAsync(values);
      saved.current = true;
      setCriteriaFlash(response.message);
      router.back();
    } catch (error) {
      const apiError = toApiError(error);
      const fields: Partial<Record<Field, string>> = {};
      for (const field of ['category', 'label', 'description', 'sort_order'] as const) {
        if (apiError.fieldErrors[field]) fields[field] = apiError.fieldErrors[field];
      }
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(apiError.kind === 'not_found' ? GONE : apiError.message);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title }} />
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
        {!editing ? <Text className="text-sm text-gray-600">New criteria appear immediately in the evaluation form — no code changes needed.</Text> : null}
        {editing && criterion && criterion.responses_count > 0 ? (
          <Text className="text-sm text-gray-600">Saved evaluations keep their ratings when this criterion changes.</Text>
        ) : null}
        {formError ? <Banner tone="error" message={formError} /> : null}
        <TextField
          label="Category"
          value={values.category}
          onChangeText={(text) => set('category', text)}
          placeholder="e.g. Work Quality"
          maxLength={CRITERION_LABEL_MAX}
          editable={!submitting}
          error={errors.category}
        />
        <TextField
          label="Label"
          value={values.label}
          onChangeText={(text) => set('label', text)}
          placeholder="e.g. Produces accurate, complete work"
          maxLength={CRITERION_LABEL_MAX}
          editable={!submitting}
          error={errors.label}
        />
        <TextField
          label="Description (optional)"
          value={values.description}
          onChangeText={(text) => set('description', text)}
          multiline
          maxLength={CRITERION_DESCRIPTION_MAX}
          editable={!submitting}
          error={errors.description}
        />
        <TextField
          label="Sort Order"
          value={values.sort_order}
          onChangeText={(text) => set('sort_order', text)}
          keyboardType="number-pad"
          maxLength={10}
          editable={!submitting}
          error={errors.sort_order}
        />
      </ScrollView>
      <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button label="Cancel" variant="outline" onPress={() => router.back()} disabled={submitting} className="flex-1" />
        <Button
          label={editing ? 'Save' : 'Add Criterion'}
          onPress={() => void submit()}
          loading={submitting}
          loadingLabel="Saving…"
          className="flex-1"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
