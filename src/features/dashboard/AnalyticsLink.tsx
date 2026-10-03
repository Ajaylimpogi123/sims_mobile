import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { MeResponse } from '@/api/types';
import { canUse, featureInfo } from '@/navigation/access';
import { colors } from '@/theme/colors';

/** Entry to the Analytics screen (the website's Dashboard "Analytics" tab). Hidden for roles without it. */
export function AnalyticsLink({ me }: { me: MeResponse | null }) {
  if (!me || !canUse('analytics', me)) return null;
  const info = featureInfo('analytics', me.user.role_id);

  return (
    <Pressable
      onPress={() => router.push('/analytics')}
      accessibilityRole="button"
      accessibilityLabel={`View analytics. ${info.description}`}
      android_ripple={{ color: 'rgba(0,0,0,0.06)', foreground: true }}
      className="flex-row items-center gap-3 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50">
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
        <Ionicons name="bar-chart" size={20} color={colors.brand700} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-gray-900">View analytics</Text>
        <Text className="text-sm text-gray-500" numberOfLines={2}>
          {info.description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
    </Pressable>
  );
}
