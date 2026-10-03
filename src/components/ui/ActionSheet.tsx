import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

export interface ActionSheetOption {
  key: string;
  label: string;
  /** Muted second line, e.g. "JPG or PNG". */
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  title: string;
  options: ActionSheetOption[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

/** A bottom sheet of a few actions plus Cancel (Android's modal bottom sheet). */
export function ActionSheet({ visible, title, options, onSelect, onClose }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View className="rounded-t-2xl bg-white" style={{ paddingBottom: insets.bottom + 8 }}>
          <View className="items-center pt-2">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>
          <Text accessibilityRole="header" className="px-4 pb-2 pt-3 text-base font-semibold text-gray-900">
            {title}
          </Text>
          {options.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => {
                onClose();
                onSelect(option.key);
              }}
              accessibilityRole="button"
              accessibilityHint={option.hint}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              className="min-h-14 flex-row items-center gap-4 px-4 py-3">
              <Ionicons name={option.icon} size={22} color={option.destructive ? colors.red600 : colors.gray500} />
              <View className="flex-1">
                <Text className={`text-base ${option.destructive ? 'text-red-600' : 'text-gray-900'}`}>{option.label}</Text>
                {option.hint ? <Text className="text-xs text-gray-500">{option.hint}</Text> : null}
              </View>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
            className="mt-1 min-h-12 items-center justify-center border-t border-gray-100">
            <Text className="text-base font-medium text-gray-600">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
