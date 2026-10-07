import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/errors';
import { monitoringKeys, useCreateEntry, useMonitoredStudent, useUpdateEntry, type EntryInput } from '@/api/monitoring';
import type { MonitoringAttendance, MonitoringAttendancePage } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { EmptyState } from '@/components/ui/EmptyState';
import { TimeField } from '@/components/ui/TimeField';
import { formatLongDate, toApiClock, todayApiDate } from '@/lib/datetime';

import { setMonitoringFlash } from './flash';
import { Text } from '@/components/ui/Text';

/** Laravel's wording for the same rules, so a client-side check reads like the server's 422. */
const RULE_MESSAGES = {
  dateRequired: 'The date field is required.',
  timeOutAfter: 'The time out field must be a date after time in.',
} as const;

const GONE_MESSAGE = 'This attendance entry is no longer available. Go back to see the current log.';

type Field = 'date' | 'time_in' | 'time_out';
type FieldErrors = Partial<Record<Field, string>>;

const LEG_NAME = { time_in: 'Time In', time_out: 'Time Out' } as const;

function findRecord(data: InfiniteData<MonitoringAttendancePage> | undefined, id: number): MonitoringAttendance | null {
  for (const page of data?.pages ?? []) {
    const found = page.data.find((record) => record.id === id);
    if (found) return found;
  }
  return null;
}

/** A leg that had a time or captured evidence and is being cleared (its photo + GPS are deleted by the server). */
function clearedLegs(record: MonitoringAttendance, entry: EntryInput): ('time_in' | 'time_out')[] {
  return (['time_in', 'time_out'] as const).filter(
    (leg) => entry[leg] === null && (record[leg] !== null || record[`${leg}_photo_url`] !== null || record[`${leg}_latitude`] !== null),
  );
}

function hasEvidence(record: MonitoringAttendance, leg: 'time_in' | 'time_out'): boolean {
  return record[`${leg}_photo_url`] !== null || record[`${leg}_latitude`] !== null;
}

/**
 * Add Entry / edit an entry (website: the LogModal's add row and inline edit): Date, Time In,
 * Time Out. Either time may be left empty; clearing a recorded leg on an edit asks first, since the
 * server also deletes that leg's photo and location. 422 errors show under the fields.
 */
export function EntryFormScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ student_id?: string; attendance_id?: string }>();
  const studentId = params.student_id && /^\d+$/.test(params.student_id) ? Number(params.student_id) : null;
  const attendanceId = params.attendance_id && /^\d+$/.test(params.attendance_id) ? Number(params.attendance_id) : null;
  const editing = attendanceId !== null;

  const student = useMonitoredStudent(studentId).data ?? null;
  const [record] = useState<MonitoringAttendance | null>(() =>
    studentId !== null && attendanceId !== null
      ? findRecord(queryClient.getQueryData<InfiniteData<MonitoringAttendancePage>>(monitoringKeys.log(studentId)), attendanceId)
      : null,
  );

  const [date, setDate] = useState<string | null>(record?.date ?? (editing ? null : todayApiDate()));
  const [timeIn, setTimeIn] = useState<string | null>(record?.time_in ? toApiClock(record.time_in) : null);
  const [timeOut, setTimeOut] = useState<string | null>(record?.time_out ? toApiClock(record.time_out) : null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const create = useCreateEntry(studentId ?? 0);
  const update = useUpdateEntry();

  const title = editing ? 'Edit Entry' : 'Add Entry';
  const allowed = editing ? record?.can_edit === true : student?.can_edit_attendance === true;

  if (studentId === null || (editing && !record) || (student && !allowed)) {
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <Stack.Screen options={{ title }} />
        <EmptyState
          icon="alert-circle-outline"
          message={student && !allowed ? "You don't have permission to do that." : GONE_MESSAGE}
        />
        <Button label="Back" variant="outline" onPress={() => router.back()} />
      </View>
    );
  }

  const clearError = (field: Field) => setErrors((old) => (old[field] ? { ...old, [field]: undefined } : old));

  const validate = (): FieldErrors => {
    const result: FieldErrors = {};
    if (!date) result.date = RULE_MESSAGES.dateRequired;
    if (timeIn && timeOut && timeOut <= timeIn) result.time_out = RULE_MESSAGES.timeOutAfter;
    return result;
  };

  const send = async (entry: EntryInput) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const response = editing ? await update.mutateAsync({ id: attendanceId!, entry }) : await create.mutateAsync(entry);
      setMonitoringFlash(response.message);
      router.back();
    } catch (error) {
      const apiError = toApiError(error);
      const fields: FieldErrors = {};
      for (const field of ['date', 'time_in', 'time_out'] as const) {
        if (apiError.fieldErrors[field]) fields[field] = apiError.fieldErrors[field];
      }
      setErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(apiError.kind === 'not_found' ? GONE_MESSAGE : apiError.message);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const submit = () => {
    if (inFlight.current) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !date) return;
    const entry: EntryInput = { date, time_in: timeIn, time_out: timeOut };

    const cleared = record ? clearedLegs(record, entry) : [];
    if (record && cleared.length > 0) {
      const names = cleared.map((leg) => LEG_NAME[leg]).join(' and ');
      const evidence = cleared.some((leg) => hasEvidence(record, leg));
      Alert.alert(
        `Clear ${names}?`,
        evidence
          ? `The student's photo and location for ${names} will be deleted too. This can't be undone.`
          : `${names} will be removed from this entry.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Clear and Save', style: 'destructive', onPress: () => void send(entry) },
        ],
      );
      return;
    }
    void send(entry);
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title }} />
      <ScrollView className="flex-1" contentContainerClassName="gap-5 p-4" keyboardShouldPersistTaps="handled">
        <View className="gap-0.5">
          <Text accessibilityRole="header" className="text-base font-semibold text-gray-900">
            Attendance Log — {student?.name ?? ''}
          </Text>
          <Text className="text-sm text-gray-500">
            {editing && record ? `Correct the entry for ${formatLongDate(record.date)}` : 'Add a missed entry'}
          </Text>
        </View>
        {formError ? <Banner tone="error" message={formError} /> : null}
        <DateField
          label="Date"
          value={date}
          placeholder="Select a date"
          clearable={false}
          minimumDate="2000-01-01"
          maximumDate={todayApiDate()}
          onChange={(value) => {
            setDate(value);
            clearError('date');
          }}
          error={errors.date}
        />
        <View className="flex-row gap-3">
          <TimeField
            label="Time In"
            value={timeIn}
            disabled={submitting}
            onChange={(value) => {
              setTimeIn(value);
              clearError('time_in');
              clearError('time_out');
            }}
            error={errors.time_in}
          />
          <TimeField
            label="Time Out"
            value={timeOut}
            disabled={submitting}
            onChange={(value) => {
              setTimeOut(value);
              clearError('time_out');
            }}
            error={errors.time_out}
          />
        </View>
        <Text className="text-xs text-gray-500">Staff entries are saved as approved. Hours are counted when both times are set.</Text>
      </ScrollView>
      <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <Button label="Cancel" variant="outline" onPress={() => router.back()} disabled={submitting} className="flex-1" />
        <Button
          label={editing ? 'Save' : 'Add Entry'}
          onPress={submit}
          loading={submitting}
          loadingLabel="Saving…"
          className="flex-1"
        />
      </View>
    </KeyboardAvoidingView>
  );
}
