import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  COMPANY_CONTACT_NUMBER_MAX,
  COMPANY_NEW_CONTACT_DIGITS,
  COMPANY_TEXT_MAX,
  companyFromLists,
  companyKeys,
  useCompany,
  useCreateCompany,
  useSupervisorOptions,
  useUpdateCompany,
  type CompanyInput,
} from '@/api/companies';
import { toApiError } from '@/api/errors';
import type { ManagedCompany } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PickerField } from '@/components/ui/PickerField';
import { SelectSheet, type SelectOption } from '@/components/ui/SelectSheet';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';

import { SUPERVISOR_ISSUE_SUFFIX } from '@/features/assignments/SupervisorFlag';

import { COMPANY_NOT_FOUND, setCompaniesFlash, setCompanyDetailFlash } from './flash';
import { Text, TextInput } from '@/components/ui/Text';

type Field = keyof CompanyInput;
const FIELDS: Field[] = ['company_name', 'address', 'supervisor_id', 'contact_number', 'email', 'industry', 'slots'];

/** Laravel's wording for the same rules (the server's message wins when it answers). */
const RULE_MESSAGES = {
  company_name: 'The company name field is required.',
  slots: 'The slots field is required.',
  slotsInteger: 'The slots field must be an integer.',
} as const;

function FormSkeleton() {
  return (
    <SkeletonPulse label="Loading form">
      <View className="gap-5 p-4">
        {[0, 1, 2, 3].map((i) => (
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
// Screen: loads the company (edit), then mounts the form with fixed starting values
// ---------------------------------------------------------------------------

/**
 * Add Company / Edit Company (website: AddModal / EditModal): Company Name, Address, Company
 * Supervisor, Contact Number, Email, Industry, Internship Slots, in the website's order.
 */
export function CompanyFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = params.id !== undefined;
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const title = editing ? 'Edit Company' : 'Add Company';

  const [cached] = useState<ManagedCompany | undefined>(() =>
    id === null ? undefined : (queryClient.getQueryData<ManagedCompany>(companyKeys.detail(id)) ?? companyFromLists(queryClient, id)),
  );
  const companyQuery = useCompany(editing ? id : null);

  if (!editing) return <CompanyForm title={title} company={null} />;

  const error = companyQuery.isError ? toApiError(companyQuery.error) : null;
  const company = companyQuery.data ?? cached;
  if (id === null || error?.kind === 'not_found') {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title }} />
        <EmptyState icon="alert-circle-outline" message={COMPANY_NOT_FOUND} />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }
  if (!company) {
    return (
      <View className="flex-1 bg-gray-50">
        <Stack.Screen options={{ title }} />
        {error ? (
          <View className="p-4">
            <ErrorState message={error.message} onRetry={() => void companyQuery.refetch()} retrying={companyQuery.isFetching} />
          </View>
        ) : (
          <FormSkeleton />
        )}
      </View>
    );
  }
  if (!company.can_edit) {
    return (
      <View className="flex-1 gap-3 bg-gray-50 p-4">
        <Stack.Screen options={{ title }} />
        <EmptyState icon="lock-closed-outline" message="You can't edit this company." />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }
  return <CompanyForm key={company.id} title={title} company={company} />;
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

function CompanyForm({ title, company }: { title: string; company: ManagedCompany | null }) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const editing = company !== null;

  const [start] = useState<CompanyInput>(() => ({
    company_name: company?.company_name ?? '',
    address: company?.address ?? '',
    supervisor_id: company?.supervisor_id ?? null,
    contact_number: company?.contact_number ?? '',
    email: company?.email ?? '',
    industry: company?.industry ?? '',
    // Website Add form starts at 0.
    slots: String(company?.slots ?? 0),
  }));
  const [values, setValues] = useState<CompanyInput>(start);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const saved = useRef(false);
  const refs = {
    address: useRef<TextInput>(null),
    contact_number: useRef<TextInput>(null),
    email: useRef<TextInput>(null),
    industry: useRef<TextInput>(null),
    slots: useRef<TextInput>(null),
  };

  const create = useCreateCompany();
  const update = useUpdateCompany();
  const supervisors = useSupervisorOptions();
  const [picking, setPicking] = useState(false);

  // Active Supervisor accounts, plus the company's current one when it no longer is a valid pick
  // (inactive / lost the role): it can be kept unchanged, as on the website.
  const current = company?.supervisor ?? null;
  const currentSuffix = company?.supervisor_issue ? SUPERVISOR_ISSUE_SUFFIX[company.supervisor_issue] : undefined;
  const supervisorOptions = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = (supervisors.data ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.email }));
    if (current && !options.some((o) => o.value === current.id)) {
      options.unshift({ value: current.id, label: currentSuffix ? `${current.name} (${currentSuffix})` : current.name, hint: current.email });
    }
    return options;
  }, [supervisors.data, current, currentSuffix]);
  const picked = supervisorOptions.find((o) => o.value === values.supervisor_id);
  const supervisorLabel = values.supervisor_id === null ? 'No supervisor' : (picked?.label ?? null);

  const studentsCount = company?.students_count ?? 0;
  const changed = editing && values.supervisor_id !== (company?.supervisor_id ?? null);
  const atCompany = studentsCount === 1 ? 'The 1 student at this company' : `All ${studentsCount} students at this company`;
  const moveMessage =
    changed && studentsCount > 0
      ? values.supervisor_id === null
        ? `${atCompany} will be left without a supervisor.`
        : `${atCompany} will be moved to ${picked?.label ?? 'the new supervisor'}.`
      : null;

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
        Alert.alert('Discard changes?', editing ? 'Your changes to this company will be lost.' : 'This company will not be added.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
        ]);
      }),
    [navigation, editing],
  );

  const set = (field: Exclude<Field, 'supervisor_id'>, value: string) => {
    setValues((old) => ({ ...old, [field]: value }));
    setErrors((old) => (old[field] ? { ...old, [field]: undefined } : old));
  };

  const validate = () => {
    const found: Partial<Record<Field, string>> = {};
    if (!values.company_name.trim()) found.company_name = RULE_MESSAGES.company_name;
    const slots = values.slots.trim();
    if (!slots) found.slots = RULE_MESSAGES.slots;
    else if (!/^\d+$/.test(slots)) found.slots = RULE_MESSAGES.slotsInteger;
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = async () => {
    if (inFlight.current || !validate()) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const response = company ? await update.mutateAsync({ id: company.id, input: values }) : await create.mutateAsync(values);
      saved.current = true;
      setCompaniesFlash(response.message);
      if (company) setCompanyDetailFlash(response.message);
      inFlight.current = false;
      router.back();
    } catch (error) {
      const apiError = toApiError(error);
      const fields: Partial<Record<Field, string>> = {};
      for (const field of FIELDS) {
        if (apiError.fieldErrors[field]) fields[field] = apiError.fieldErrors[field];
      }
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(apiError.kind === 'not_found' ? COMPANY_NOT_FOUND : apiError.message);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  /**
   * Website EditModal: saving a different supervisor moves every student at the company, so ask
   * first (same wording as its warning).
   */
  const confirmAndSubmit = () => {
    if (inFlight.current) return;
    if (!moveMessage) {
      void submit();
      return;
    }
    Alert.alert('Change supervisor?', `${moveMessage} Continue?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', onPress: () => void submit() },
    ]);
  };

  const next = (field: keyof typeof refs) => () => refs[field].current?.focus();

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title }} />
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
        {company ? <Text className="text-sm text-gray-600">Update company details</Text> : null}
        {formError ? <Banner tone="error" message={formError} /> : null}
        <TextField
          label="Company Name"
          value={values.company_name}
          onChangeText={(text) => set('company_name', text)}
          autoCapitalize="words"
          maxLength={COMPANY_TEXT_MAX}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={next('address')}
          editable={!submitting}
          error={errors.company_name}
        />
        <TextField
          ref={refs.address}
          label="Address"
          value={values.address}
          onChangeText={(text) => set('address', text)}
          autoCapitalize="words"
          autoComplete="street-address"
          maxLength={COMPANY_TEXT_MAX}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={next('contact_number')}
          editable={!submitting}
          error={errors.address}
        />
        <View className="gap-1">
          <PickerField
            label="Company Supervisor"
            icon="person-outline"
            value={supervisorLabel}
            placeholder="No supervisor"
            onPress={() => setPicking(true)}
            disabled={submitting}
            error={errors.supervisor_id ?? (supervisors.isError ? toApiError(supervisors.error).message : null)}
          />
          {moveMessage ? (
            <Text className="text-xs text-amber-700">{moveMessage}</Text>
          ) : (
            <Text className="text-xs text-gray-500">Every student placed at this company is supervised by this person.</Text>
          )}
        </View>
        <TextField
          ref={refs.contact_number}
          label="Contact Number"
          value={values.contact_number}
          // Website Add form: digits only, 11 at most. Edit keeps whatever is stored (up to the server's 50).
          onChangeText={(text) => set('contact_number', editing ? text : text.replace(/\D/g, '').slice(0, COMPANY_NEW_CONTACT_DIGITS))}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={editing ? COMPANY_CONTACT_NUMBER_MAX : COMPANY_NEW_CONTACT_DIGITS}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={next('email')}
          editable={!submitting}
          error={errors.contact_number}
        />
        <TextField
          ref={refs.email}
          label="Email"
          value={values.email}
          onChangeText={(text) => set('email', text)}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={COMPANY_TEXT_MAX}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={next('industry')}
          editable={!submitting}
          error={errors.email}
        />
        <TextField
          ref={refs.industry}
          label="Industry"
          value={values.industry}
          onChangeText={(text) => set('industry', text)}
          autoCapitalize="words"
          maxLength={COMPANY_TEXT_MAX}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={next('slots')}
          editable={!submitting}
          error={errors.industry}
        />
        <View className="gap-1">
          <TextField
            ref={refs.slots}
            label="Internship Slots"
            value={values.slots}
            onChangeText={(text) => set('slots', text.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            maxLength={10}
            returnKeyType="done"
            editable={!submitting}
            error={errors.slots}
          />
          {company && company.students_count > 0 ? (
            <Text className="text-xs text-gray-500">
              {company.students_count === 1 ? '1 student is' : `${company.students_count} students are`} already assigned to this company.
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button label="Cancel" variant="outline" onPress={() => router.back()} disabled={submitting} className="flex-1" />
        <Button label={editing ? 'Save' : 'Submit'} onPress={confirmAndSubmit} loading={submitting} loadingLabel="Saving…" className="flex-1" />
      </View>
      <SelectSheet
        visible={picking}
        title="Company Supervisor"
        allLabel="No supervisor"
        options={supervisorOptions}
        selected={values.supervisor_id}
        onSelect={(value) => {
          setValues((old) => ({ ...old, supervisor_id: value }));
          setErrors((old) => (old.supervisor_id ? { ...old, supervisor_id: undefined } : old));
        }}
        onClose={() => setPicking(false)}
        emptyText={supervisors.isPending ? 'Loading supervisors…' : 'No active supervisor accounts yet'}
      />
    </KeyboardAvoidingView>
  );
}
