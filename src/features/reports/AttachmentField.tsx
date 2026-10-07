import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { authImageSource } from '@/api/images';
import type { PickedFile } from '@/api/reports';
import type { ReportAttachment } from '@/api/types';
import { ActionSheet, type ActionSheetOption } from '@/components/ui/ActionSheet';
import { colors } from '@/theme/colors';

import { ATTACHMENT_HINT, pickAttachment, type AttachmentSource } from './attachment';
import { AttachmentSummary } from './AttachmentCard';
import { Text } from '@/components/ui/Text';

const SOURCES: { key: AttachmentSource; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { key: 'camera', label: 'Take photo', icon: 'camera-outline', hint: 'Use the camera' },
  { key: 'library', label: 'Choose image', icon: 'image-outline', hint: 'JPG or PNG from your gallery' },
  { key: 'pdf', label: 'Choose PDF', icon: 'document-outline', hint: 'A PDF from your files' },
];

const SHEET_OPTIONS: ActionSheetOption[] = SOURCES.map(({ key, label, icon, hint }) => ({ key, label, icon, hint }));

interface AttachmentFieldProps {
  /** The report's current file (edit only). */
  existing: ReportAttachment | null;
  /** A newly picked file; replaces `existing` on save. */
  picked: PickedFile | null;
  /** Edit only: the current file will be removed on save. */
  removeExisting: boolean;
  onPicked: (file: PickedFile) => void;
  onClearPicked: () => void;
  onRemoveExisting: () => void;
  onUndoRemove: () => void;
  /** Client-side check failed (type / size), shown like a 422 error. */
  onPickError: (message: string) => void;
  error?: string | null;
  disabled?: boolean;
}

function Thumbnail({ uri, headers }: { uri: string; headers?: Record<string, string> }) {
  return (
    <View className="h-10 w-10 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
      <Image source={headers ? { uri, headers, cacheKey: uri } : { uri }} cachePolicy="disk" contentFit="cover" style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

function SmallAction({ label, onPress, tone = 'brand', disabled }: { label: string; onPress: () => void; tone?: 'brand' | 'red'; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={6}
      className={`min-h-11 justify-center rounded-md px-2 ${tone === 'red' ? 'active:bg-red-50' : 'active:bg-brand-50'} ${disabled ? 'opacity-50' : ''}`}>
      <Text className={`text-sm font-medium ${tone === 'red' ? 'text-red-600' : 'text-brand-700'}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Report attachment (website: "Attachment (optional)" file input): take a photo, choose an image or a PDF.
 * On edit it shows the current file with Replace / Remove.
 */
export function AttachmentField({
  existing,
  picked,
  removeExisting,
  onPicked,
  onClearPicked,
  onRemoveExisting,
  onUndoRemove,
  onPickError,
  error,
  disabled = false,
}: AttachmentFieldProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const pick = async (source: AttachmentSource) => {
    if (preparing || disabled) return;
    setPreparing(true);
    try {
      const outcome = await pickAttachment(source);
      if (!outcome) return;
      if ('error' in outcome) onPickError(outcome.error);
      else onPicked(outcome.file);
    } finally {
      setPreparing(false);
    }
  };

  const showsExisting = !picked && existing && !removeExisting;
  const existingSource = showsExisting && existing.kind === 'image' ? authImageSource(existing.url) : null;

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">Attachment (optional)</Text>

      {preparing ? (
        <View className="h-20 flex-row items-center justify-center gap-2 rounded-md border border-gray-200 bg-white" accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.brand700} />
          <Text className="text-sm text-gray-600">Preparing attachment…</Text>
        </View>
      ) : picked ? (
        <View className={`flex-row items-center gap-1 rounded-md border bg-white py-2 pl-3 pr-1 ${error ? 'border-red-500' : 'border-gray-300'}`}>
          {picked.mimeType !== 'application/pdf' ? <Thumbnail uri={picked.uri} /> : null}
          <AttachmentSummary
            name={picked.name}
            kind={picked.mimeType === 'application/pdf' ? 'pdf' : 'image'}
            size={picked.size}
            meta={existing ? 'Replaces the current file' : undefined}
          />
          <SmallAction label="Change" onPress={() => setSheetOpen(true)} disabled={disabled} />
          <SmallAction label="Remove" tone="red" onPress={onClearPicked} disabled={disabled} />
        </View>
      ) : showsExisting ? (
        <View className={`flex-row items-center gap-1 rounded-md border bg-white py-2 pl-3 pr-1 ${error ? 'border-red-500' : 'border-gray-300'}`}>
          {existingSource ? <Thumbnail uri={existingSource.uri} headers={existingSource.headers} /> : null}
          <AttachmentSummary name={existing.name} kind={existing.kind} size={existing.size} meta="Current" />
          <SmallAction label="Replace" onPress={() => setSheetOpen(true)} disabled={disabled} />
          <SmallAction label="Remove" tone="red" onPress={onRemoveExisting} disabled={disabled} />
        </View>
      ) : (
        <>
          {removeExisting && existing ? (
            <View className="flex-row items-center gap-2 rounded-md border border-amber-200 bg-amber-50 py-1 pl-3 pr-1">
              <Text className="flex-1 text-sm text-amber-800" numberOfLines={2}>
                {existing.name} will be removed when you save.
              </Text>
              <SmallAction label="Undo" onPress={onUndoRemove} disabled={disabled} />
            </View>
          ) : null}
          <View className="flex-row gap-2">
            {SOURCES.map((source) => (
              <Pressable
                key={source.key}
                onPress={() => void pick(source.key)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={source.label}
                accessibilityHint={source.hint}
                className={`h-20 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed bg-white active:bg-gray-50 ${error ? 'border-red-500' : 'border-gray-300'} ${disabled ? 'opacity-50' : ''}`}>
                <Ionicons name={source.icon} size={22} color={colors.brand700} />
                <Text className="text-xs font-medium text-gray-700">{source.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {error ? <Text className="text-sm text-red-600">{error}</Text> : <Text className="text-xs text-gray-500">{ATTACHMENT_HINT}</Text>}

      <ActionSheet
        visible={sheetOpen}
        title={existing && !picked ? 'Replace attachment' : 'Change attachment'}
        options={SHEET_OPTIONS}
        onSelect={(key) => void pick(key as AttachmentSource)}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
