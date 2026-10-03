import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authImageSource } from '@/api/images';
import { colors } from '@/theme/colors';

/**
 * A leg's photo thumbnail (website: AttendanceEvidence), fetched with the Bearer token.
 * Tap for the full-size photo. Shows "Photo unavailable" if it can't load (404, offline).
 */
export function AttendancePhoto({ url, label }: { url: string | null; label: string }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const source = authImageSource(url);

  if (!source) {
    return (
      <View
        className="h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-gray-50"
        accessible
        accessibilityLabel={`${label}: no photo`}>
        <Ionicons name="image-outline" size={18} color={colors.gray400} />
      </View>
    );
  }

  if (failedUrl === source.uri) {
    return (
      <Pressable
        onPress={() => setFailedUrl(null)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: photo unavailable`}
        accessibilityHint="Tries to load the photo again"
        className="h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
        <Ionicons name="alert-circle-outline" size={18} color={colors.gray500} />
      </Pressable>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={label}
        accessibilityHint="Opens the full-size photo"
        className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
        <Image
          source={source}
          cachePolicy="disk"
          contentFit="cover"
          transition={150}
          recyclingKey={source.uri}
          style={{ width: '100%', height: '100%' }}
          onError={() => setFailedUrl(source.uri)}
        />
      </Pressable>
      <Modal visible={open} transparent={false} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View className="flex-1 bg-black">
          <Image
            source={source}
            cachePolicy="disk"
            contentFit="contain"
            style={{ flex: 1 }}
            accessibilityLabel={label}
            onError={() => {
              setOpen(false);
              setFailedUrl(source.uri);
            }}
          />
          <View
            className="absolute left-0 right-0 flex-row items-center justify-between px-4"
            style={{ top: insets.top + 8 }}>
            <Text className="flex-1 text-base font-medium text-white" numberOfLines={1}>
              {label}
            </Text>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close photo"
              className="h-12 w-12 items-center justify-center rounded-full bg-black/50 active:bg-black/70">
              <Ionicons name="close" size={24} color={colors.white} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
