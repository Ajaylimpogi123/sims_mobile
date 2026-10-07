import { View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { formatLongDate, greeting } from '@/lib/datetime';
import { Text } from '@/components/ui/Text';

/** "Good morning, Juan" + today's date in Manila. */
export function HomeGreeting() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0] ?? '';
  const now = new Date();

  return (
    <View className="gap-1 px-1 pt-2">
      <Text className="text-2xl font-semibold text-gray-900">
        {greeting(now)}
        {firstName ? `, ${firstName}` : ''}
      </Text>
      <Text className="text-sm text-gray-500">{formatLongDate(now)}</Text>
    </View>
  );
}
