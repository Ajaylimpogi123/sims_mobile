import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { toApiError } from '@/api/errors';
import { authImageSource } from '@/api/images';
import type { ReportAttachment } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { downloadProtectedFile, openFile, shareFile } from '@/lib/downloads';
import { colors } from '@/theme/colors';

import { formatFileSize, KIND_LABEL } from './format';
import { ImageViewer } from './ImageViewer';
import { Text } from '@/components/ui/Text';

/** Icon + name + size of an attachment (detail card and form field). */
export function AttachmentSummary({ name, kind, size, meta }: { name: string; kind: ReportAttachment['kind']; size: number | null; meta?: string }) {
  const details = [KIND_LABEL[kind], formatFileSize(size), meta].filter(Boolean).join(' · ');
  return (
    <View className="flex-1 flex-row items-center gap-3">
      <View className={`h-10 w-10 items-center justify-center rounded-lg ${kind === 'pdf' ? 'bg-red-50' : 'bg-gray-100'}`}>
        <Ionicons name={kind === 'pdf' ? 'document-text-outline' : kind === 'image' ? 'image-outline' : 'document-attach-outline'} size={20} color={kind === 'pdf' ? colors.red600 : colors.gray500} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1} ellipsizeMode="middle">
          {name}
        </Text>
        <Text className="text-xs text-gray-500">{details}</Text>
      </View>
    </View>
  );
}

/**
 * Report detail: the attachment. Images show in the app (fetched with the Bearer token); a PDF is
 * downloaded to the cache and opened in the phone's PDF viewer. Share works for both.
 */
export function AttachmentCard({ attachment }: { attachment: ReportAttachment }) {
  const [busy, setBusy] = useState<'open' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const source = attachment.kind === 'image' ? authImageSource(attachment.url) : null;
  const imageFailed = !!source && failedUri === source.uri;

  const run = async (mode: 'open' | 'share') => {
    if (busy) return;
    setBusy(mode);
    setError(null);
    try {
      const file = await downloadProtectedFile(attachment.url, attachment.name);
      if (mode === 'open') openFile(file, attachment.mime, attachment.name, setError);
      else await shareFile(file, attachment.mime, attachment.name);
    } catch (caught) {
      const apiError = toApiError(caught);
      // A 401 already sent the user back to login.
      if (!apiError.endsSession) setError(apiError.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title="Attachment">
      {source ? (
        imageFailed ? (
          <Pressable
            onPress={() => setFailedUri(null)}
            accessibilityRole="button"
            accessibilityHint="Tries to load the image again"
            className="mb-3 h-40 items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50">
            <Ionicons name="alert-circle-outline" size={22} color={colors.gray500} />
            <Text className="text-sm text-gray-600">Image unavailable. Tap to try again.</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setViewerOpen(true)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Attachment ${attachment.name}`}
            accessibilityHint="Opens the full-size image"
            className="mb-3 h-56 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
            <Image
              source={source}
              cachePolicy="disk"
              contentFit="contain"
              transition={150}
              recyclingKey={source.uri}
              style={{ width: '100%', height: '100%' }}
              onError={() => setFailedUri(source.uri)}
            />
          </Pressable>
        )
      ) : null}

      <AttachmentSummary name={attachment.name} kind={attachment.kind} size={attachment.size} />

      <View className="mt-3 flex-row gap-3">
        {source ? (
          <Button label="View" icon="expand-outline" variant="outline" className="flex-1" disabled={imageFailed} onPress={() => setViewerOpen(true)} />
        ) : (
          <Button
            label={attachment.kind === 'pdf' ? 'Open PDF' : 'Open'}
            icon="open-outline"
            variant="outline"
            className="flex-1"
            loading={busy === 'open'}
            loadingLabel="Opening…"
            disabled={busy !== null}
            onPress={() => void run('open')}
          />
        )}
        <Button
          label="Share"
          icon="share-social-outline"
          variant="outline"
          className="flex-1"
          loading={busy === 'share'}
          loadingLabel="Preparing…"
          disabled={busy !== null}
          accessibilityHint="Save or send the attachment with another app"
          onPress={() => void run('share')}
        />
      </View>
      {error ? (
        <View className="mt-3">
          <Banner message={error} />
        </View>
      ) : null}

      {source ? (
        <ImageViewer
          visible={viewerOpen}
          source={source}
          title={attachment.name}
          onClose={() => setViewerOpen(false)}
          onError={() => {
            setViewerOpen(false);
            setFailedUri(source.uri);
          }}
        />
      ) : null}
    </Card>
  );
}
