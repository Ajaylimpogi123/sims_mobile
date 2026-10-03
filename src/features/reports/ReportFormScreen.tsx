import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MESSAGES, toApiError, type ApiError } from '@/api/errors';
import {
  getReport,
  getReports,
  notPendingReport,
  refreshAfterReportChange,
  reportKeys,
  useCreateReport,
  useReport,
  useUpdateReport,
  type PickedFile,
  type ReportInput,
} from '@/api/reports';
import type { Report, ReportType } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { todayApiDate } from '@/lib/datetime';
import { formatNumber } from '@/lib/format';

import { AttachmentField } from './AttachmentField';
import { setReportsFlash } from './flash';
import { TYPE_LABEL } from './format';

/** The API's cap on Accomplishment Details. */
const CONTENT_MAX = 16_000;
const TYPE_OPTIONS = (['daily', 'weekly'] as const).map((value) => ({ value, label: TYPE_LABEL[value] }));

/** Laravel's wording for the same rules, so a client-side check reads like the server's 422. */
const RULE_MESSAGES = {
  periodStartRequired: 'The period start field is required.',
  periodEndRequired: 'The period end field is required.',
  periodEndAfterStart: 'The period end field must be a date after or equal to period start.',
  contentRequired: 'The content field is required.',
  contentMax: `The content field must not be greater than ${CONTENT_MAX} characters.`,
} as const;

/** The server's success messages, for a save whose response was lost but which the server kept. */
const SAVED_MESSAGES = { create: 'Report submitted for review.', update: 'Report updated.' } as const;

type FieldErrors = Partial<Record<'type' | 'period_start' | 'period_end' | 'content' | 'attachment', string>>;

interface FormValues {
  type: ReportType;
  periodStart: string | null;
  periodEnd: string | null;
  content: string;
}

function initialValues(report: Report | null): FormValues {
  if (report) {
    return { type: report.type, periodStart: report.period_start, periodEnd: report.period_end, content: report.content };
  }
  // The website starts empty; on the phone most reports are for today.
  const today = todayApiDate();
  return { type: 'daily', periodStart: today, periodEnd: today, content: '' };
}

function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.periodStart) errors.period_start = RULE_MESSAGES.periodStartRequired;
  if (values.type === 'weekly') {
    if (!values.periodEnd) errors.period_end = RULE_MESSAGES.periodEndRequired;
    else if (values.periodStart && values.periodEnd < values.periodStart) errors.period_end = RULE_MESSAGES.periodEndAfterStart;
  }
  if (!values.content.trim()) errors.content = RULE_MESSAGES.contentRequired;
  else if (values.content.length > CONTENT_MAX) errors.content = RULE_MESSAGES.contentMax;
  return errors;
}

/** 422 `errors` keys → the field that shows them (remove_attachment shows under the attachment). */
function toFieldErrors(fieldErrors: Record<string, string>): FieldErrors {
  const result: FieldErrors = {};
  for (const [key, message] of Object.entries(fieldErrors)) {
    if (key === 'type' || key === 'period_start' || key === 'period_end' || key === 'content') result[key] = message;
    else if (key === 'attachment' || key === 'remove_attachment') result.attachment ??= message;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Route entry: /report-form (New Report) or /report-form?id=12 (Edit Report)
// ---------------------------------------------------------------------------

export function ReportFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (id === undefined) return <ReportForm initial={null} />;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) return <Unavailable message={MESSAGES.notFound} />;
  return <EditReport id={reportId} />;
}

function Unavailable({ message }: { message: string }) {
  const router = useRouter();
  return (
    <View className="flex-1 gap-3 bg-gray-50 p-4">
      <Stack.Screen options={{ title: 'Edit Report' }} />
      <Banner tone="warning" message={message} />
      <Button label="Back" variant="outline" onPress={() => router.back()} />
    </View>
  );
}

function EditReport({ id }: { id: number }) {
  const query = useReport(id);
  // Freeze the report the form started from: a background refresh must not reset what's being typed.
  const [initial, setInitial] = useState<Report | null>(null);
  if (!initial && query.data?.can_edit) setInitial(query.data);

  if (initial) return <ReportForm initial={initial} />;
  if (query.data) return <Unavailable message="This report has already been reviewed and can no longer be changed." />;
  if (query.isPending) {
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <Stack.Screen options={{ title: 'Edit Report' }} />
        <SkeletonPulse label="Loading report">
          <View className="gap-4">
            <SkeletonBlock className="h-12 w-full rounded-xl" />
            <SkeletonBlock className="h-12 w-full rounded-xl" />
            <SkeletonBlock className="h-40 w-full rounded-xl" />
          </View>
        </SkeletonPulse>
      </View>
    );
  }
  const error = toApiError(query.error);
  if (error.kind === 'not_found') return <Unavailable message="We couldn't find that report. It may have been deleted." />;
  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Stack.Screen options={{ title: 'Edit Report' }} />
      <ErrorState message={error.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The form (website: the New Report form and EditReportModal)
// ---------------------------------------------------------------------------

function ReportForm({ initial }: { initial: Report | null }) {
  const isEdit = initial !== null;
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  const [start] = useState(() => initialValues(initial));
  const [values, setValues] = useState<FormValues>(start);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  /** The server refused because the report is no longer pending: nothing more can be saved here. */
  const [locked, setLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const create = useCreateReport();
  const update = useUpdateReport(initial?.id ?? 0);
  const submitting = create.isPending || update.isPending || verifying;

  const dirty =
    values.type !== start.type ||
    values.periodStart !== start.periodStart ||
    (values.type === 'weekly' && values.periodEnd !== start.periodEnd) ||
    values.content !== start.content ||
    picked !== null ||
    removeExisting;

  // Back / swipe: never abandon an upload half-way; ask before throwing away unsaved changes.
  // Refs, not state: on success the screen closes before React re-renders.
  const uploading = useRef(false);
  const saved = useRef(false);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (uploading.current) {
          event.preventDefault();
          return;
        }
        if (saved.current || !dirtyRef.current) return;
        event.preventDefault();
        Alert.alert('Discard changes?', isEdit ? 'Your changes to this report will be lost.' : 'This report will not be submitted.', [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
        ]);
      }),
    [navigation, isEdit],
  );

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key === 'periodStart' ? 'period_start' : key === 'periodEnd' ? 'period_end' : key]: undefined }));
  };

  // Website rules: a daily report's period is one day (period_end follows the date).
  const changeType = (type: ReportType) => {
    setValues((prev) => ({ ...prev, type, periodEnd: type === 'daily' ? prev.periodStart : prev.periodEnd }));
    setErrors((prev) => ({ ...prev, type: undefined, period_end: undefined }));
  };
  const changeStart = (value: string | null) => {
    setValues((prev) => ({ ...prev, periodStart: value, periodEnd: prev.type === 'daily' ? value : prev.periodEnd }));
    setErrors((prev) => ({ ...prev, period_start: undefined, period_end: undefined }));
  };

  const showProblem = (message: string) => {
    setBanner(message);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const finish = (message: string) => {
    uploading.current = false;
    saved.current = true;
    setReportsFlash(message);
    router.back();
  };

  /** A lost response (offline / timeout): the server may have saved it anyway. Ask before offering a resubmit. */
  const confirmAfterLostResponse = async (input: ReportInput, lostError: ApiError) => {
    setVerifying(true);
    try {
      if (initial) {
        const fresh = await getReport(initial.id);
        const attachmentMatches = input.attachment
          ? fresh.attachment?.name === input.attachment.name
          : input.removeAttachment
            ? fresh.attachment === null
            : true;
        if (
          fresh.updated_at !== initial.updated_at &&
          fresh.type === input.type &&
          fresh.period_start === input.period_start &&
          fresh.content === input.content.trim() &&
          attachmentMatches
        ) {
          queryClient.setQueryData(reportKeys.detail(fresh.id), fresh);
          refreshAfterReportChange(queryClient);
          finish(SAVED_MESSAGES.update);
          return;
        }
      } else {
        const page = await getReports({ type: input.type, status: null }, null, 50);
        const found = page.data.find((report) => report.period_start === input.period_start && report.content === input.content.trim());
        if (found) {
          queryClient.setQueryData(reportKeys.detail(found.id), found);
          refreshAfterReportChange(queryClient);
          finish(SAVED_MESSAGES.create);
          return;
        }
      }
      showProblem(`${lostError.message} Your report is still here, so you can submit it again.`);
    } catch {
      showProblem(`${lostError.message} Your report is still here, so you can submit it again.`);
    } finally {
      uploading.current = false;
      setVerifying(false);
    }
  };

  const handleError = (error: unknown, input: ReportInput) => {
    const apiError = toApiError(error);
    if (apiError.kind === 'network' || apiError.kind === 'timeout') {
      void confirmAfterLostResponse(input, apiError);
      return;
    }
    uploading.current = false;
    if (apiError.endsSession) return; // back to login, handled app-wide
    if (notPendingReport(apiError)) {
      setLocked(true);
      showProblem(apiError.message);
      return;
    }
    const fieldErrors = toFieldErrors(apiError.fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      showProblem(MESSAGES.validation);
      return;
    }
    // Rule refusals (no student profile, not found, rate limit, server error) as the server words them.
    showProblem(apiError.message);
  };

  const submit = () => {
    if (uploading.current || submitting || locked) return;
    const clientErrors = validate(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      showProblem(MESSAGES.validation);
      return;
    }
    const input: ReportInput = {
      type: values.type,
      period_start: values.periodStart as string,
      period_end: values.type === 'daily' ? (values.periodStart as string) : (values.periodEnd as string),
      content: values.content,
      attachment: picked,
      removeAttachment: !picked && removeExisting,
    };
    uploading.current = true;
    setErrors({});
    setBanner(null);
    const callbacks = {
      onSuccess: (response: { message: string }) => finish(response.message),
      onError: (error: unknown) => handleError(error, input),
    };
    if (initial) update.mutate(input, callbacks);
    else create.mutate(input, callbacks);
  };

  const inputsDisabled = submitting || locked;

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-50" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEdit ? 'Edit Report' : 'New Report', gestureEnabled: !submitting, headerBackVisible: !submitting }} />
      <ScrollView ref={scrollRef} className="flex-1" contentContainerClassName="gap-5 p-4 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="text-sm leading-5 text-gray-600">
          {isEdit ? 'Only pending reports can be edited' : 'Submit your daily/weekly accomplishment reports for review'}
        </Text>

        {banner ? <Banner message={banner} /> : null}

        <SegmentedControl label="Type" options={TYPE_OPTIONS} value={values.type} onChange={changeType} error={errors.type} disabled={inputsDisabled} />

        <View className="flex-row">
          <DateField
            label={values.type === 'daily' ? 'Date' : 'Period Start'}
            value={values.periodStart}
            onChange={changeStart}
            placeholder="Select a date"
            clearable={false}
            error={errors.period_start}
          />
        </View>

        {values.type === 'weekly' ? (
          <View className="flex-row">
            <DateField
              label="Period End"
              value={values.periodEnd}
              onChange={(value) => setField('periodEnd', value)}
              placeholder="Select a date"
              minimumDate={values.periodStart}
              clearable={false}
              error={errors.period_end}
            />
          </View>
        ) : null}

        <TextField
          label="Accomplishment Details"
          value={values.content}
          onChangeText={(text) => setField('content', text)}
          multiline
          maxLength={CONTENT_MAX}
          editable={!inputsDisabled}
          error={errors.content}
          counter={values.content.length >= CONTENT_MAX * 0.8 ? `${formatNumber(values.content.length)} / ${formatNumber(CONTENT_MAX)}` : undefined}
          style={{ minHeight: 160 }}
        />

        <AttachmentField
          existing={initial?.attachment ?? null}
          picked={picked}
          removeExisting={removeExisting}
          onPicked={(file) => {
            setPicked(file);
            setRemoveExisting(false);
            setErrors((prev) => ({ ...prev, attachment: undefined }));
          }}
          onClearPicked={() => setPicked(null)}
          onRemoveExisting={() => setRemoveExisting(true)}
          onUndoRemove={() => setRemoveExisting(false)}
          onPickError={(message) => setErrors((prev) => ({ ...prev, attachment: message }))}
          error={errors.attachment}
          disabled={inputsDisabled}
        />
      </ScrollView>

      {/* Thumb-zone action, like the capture screen. */}
      <View className="border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        {locked ? (
          <Button
            label="Back to report"
            variant="outline"
            onPress={() => {
              // Nothing here can be saved any more, so leaving discards nothing.
              saved.current = true;
              router.back();
            }}
          />
        ) : (
          <Button
            label={isEdit ? 'Save' : 'Submit Report'}
            loadingLabel={verifying ? 'Checking…' : isEdit ? 'Saving…' : 'Submitting…'}
            loading={submitting}
            onPress={submit}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
