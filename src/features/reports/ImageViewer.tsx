import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, type ImageSource } from 'expo-image';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/Text';

/** Full-screen image on black with its name and a close button (like the attendance photo viewer). */
export function ImageViewer({
  visible,
  source,
  title,
  onClose,
  onError,
}: {
  visible: boolean;
  source: ImageSource | string;
  title: string;
  onClose: () => void;
  onError?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-black">
        <Image source={source} cachePolicy="disk" contentFit="contain" style={{ flex: 1 }} accessibilityLabel={title} onError={onError} />
        <View className="absolute left-0 right-0 flex-row items-center justify-between gap-3 px-4" style={{ top: insets.top + 8 }}>
          <Text className="flex-1 text-base font-medium text-white" numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            className="h-12 w-12 items-center justify-center rounded-full bg-black/50 active:bg-black/70">
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
