import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/errors';
import { useSetRequiredHours } from '@/api/monitoring';
import type { MonitoredStudent } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';

/** Laravel's wording for the same rule, so the client check reads like the server's 422. */
const INTEGER_MESSAGE = 'The required hours field must be an integer.';

interface RequiredHoursSheetProps {
  student: MonitoredStudent | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/**
 * The website's "Set Required Hours" dialog as a bottom sheet: one number field, Cancel / Save.
 * Blank (or 0) means "Not set", as on the website.
 */
export function RequiredHoursSheet({ student, onClose, onSaved }: RequiredHoursSheetProps) {
  const insets = useSafeAreaInsets();
  const mutation = useSetRequiredHours(student?.id ?? 0);
  const inFlight = useRef(false);
  const [value, setValue] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = student !== null;

  useEffect(() => {
    if (!student) return;
    setValue(student.required_hours !== null ? String(student.required_hours) : '');
    setFieldError(null);
    setError(null);
  }, [student]);

  const submitting = mutation.isPending;
  const close = () => {
    if (!inFlight.current) onClose();
  };

  const save = async () => {
    if (inFlight.current || !student) return;
    const trimmed = value.trim();
    if (trimmed && !/^\d+$/.test(trimmed)) {
      setFieldError(INTEGER_MESSAGE);
      return;
    }
    inFlight.current = true;
    setFieldError(null);
    setError(null);
    try {
      const response = await mutation.mutateAsync(trimmed ? Number(trimmed) : null);
      onSaved(response.message);
    } catch (e) {
      const apiError = toApiError(e);
      if (apiError.fieldErrors.required_hours) setFieldError(apiError.fieldErrors.required_hours);
      else setError(apiError.message);
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={close} accessibilityRole="button" accessibilityLabel="Cancel" />
        <View className="gap-4 rounded-t-2xl bg-white px-4" style={{ paddingBottom: insets.bottom + 16 }}>
          <View className="items-center pt-2">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>
          <View className="gap-0.5">
            <Text accessibilityRole="header" className="text-base font-semibold text-gray-900">
              Set Required Hours
            </Text>
            <Text className="text-sm text-gray-500" numberOfLines={2}>
              Total internship hours required for {student?.name}
            </Text>
          </View>
          {error ? <Banner tone="error" message={error} /> : null}
          <TextField
            label="Required Hours"
            value={value}
            onChangeText={(text) => {
              setValue(text);
              setFieldError(null);
            }}
            keyboardType="number-pad"
            autoFocus
            editable={!submitting}
            placeholder="Not set"
            maxLength={10}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
            error={fieldError}
          />
          <View className="flex-row gap-3">
            <Button label="Cancel" variant="outline" onPress={close} disabled={submitting} className="flex-1" />
            <Button label="Save" onPress={() => void save()} loading={submitting} loadingLabel="Saving…" className="flex-1" />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
