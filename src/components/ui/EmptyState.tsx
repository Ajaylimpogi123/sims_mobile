import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

/** Same parts as the website's EmptyState: optional icon, optional title, message. */
export function EmptyState({
  message,
  title,
  icon,
}: {
  message: string;
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View className="items-center gap-2 px-4 py-6">
      {icon ? (
        <View className="mb-1 h-11 w-11 items-center justify-center rounded-full bg-gray-100">
          <Ionicons name={icon} size={22} color={colors.gray500} />
        </View>
      ) : null}
      {title ? <Text className="text-center text-sm font-medium text-gray-900">{title}</Text> : null}
      <Text className="text-center text-sm text-gray-500">{message}</Text>
    </View>
  );
}
