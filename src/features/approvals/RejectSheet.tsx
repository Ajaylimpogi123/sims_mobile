import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { REJECT_REASON_MAX } from '@/api/approvals';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { formatNumber } from '@/lib/format';

/** Characters as the server counts them (code points, not UTF-16 units). */
const countChars = (text: string) => Array.from(text).length;

interface RejectSheetProps {
  visible: boolean;
  /** e.g. "Reject Time In" */
  title: string;
  /** e.g. "Juan Dela Cruz · Oct 2, 2026 · 8:05 AM" */
  subtitle: string;
  submitting: boolean;
  /** 422 errors.reason[0] */
  fieldError: string | null;
  /** Anything else that failed while the sheet is open (offline, server error). */
  error: string | null;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}

/**
 * The website's "Reason for rejection (optional):" prompt as a bottom sheet. The reason is
 * optional (blank = no reason) and at most 500 characters, as the server validates.
 */
export function RejectSheet({ visible, title, subtitle, submitting, fieldError, error, onSubmit, onClose }: RejectSheetProps) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');

  // Fresh reason each time the sheet opens.
  useEffect(() => {
    if (visible) setReason('');
  }, [visible]);

  const chars = countChars(reason);
  const tooLong = chars > REJECT_REASON_MAX;
  const close = () => {
    if (!submitting) onClose();
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
              {title}
            </Text>
            <Text className="text-sm text-gray-500" numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          {error ? <Banner tone="error" message={error} /> : null}
          <TextField
            label="Reason for rejection (optional)"
            value={reason}
            onChangeText={setReason}
            multiline
            autoFocus
            editable={!submitting}
            placeholder="Tell the student why"
            error={tooLong ? `The reason field must not be greater than ${REJECT_REASON_MAX} characters.` : fieldError}
            counter={chars >= REJECT_REASON_MAX * 0.8 ? `${formatNumber(chars)} / ${formatNumber(REJECT_REASON_MAX)}` : undefined}
          />
          <View className="flex-row gap-3">
            <Button label="Cancel" variant="outline" onPress={close} disabled={submitting} className="flex-1" />
            <Button
              label="Reject"
              variant="destructive"
              onPress={() => onSubmit(reason)}
              loading={submitting}
              loadingLabel="Rejecting…"
              disabled={tooLong}
              className="flex-1"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
