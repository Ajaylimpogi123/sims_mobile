import { Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { formatLongDate, greeting } from '@/lib/datetime';

/** "Good morning, Juan" + today's date in Manila. */
export function HomeGreeting() {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0] ?? '';
  const now = new Date();

  return (
    <View className="gap-1 px-1 pt-2">
      <Text className="text-2xl font-semibold text-slate-900">
        {greeting(now)}
        {firstName ? `, ${firstName}` : ''}
      </Text>
      <Text className="text-sm text-slate-500">{formatLongDate(now)}</Text>
    </View>
  );
}
