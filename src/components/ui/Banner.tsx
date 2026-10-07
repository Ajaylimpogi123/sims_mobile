import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { colors } from '@/theme/colors';

import { Text } from './Text';

type Tone = 'error' | 'warning' | 'info' | 'success';

const styles: Record<Tone, { box: string; text: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  error: { box: 'border-red-200 bg-red-50', text: 'text-red-700', icon: 'alert-circle', color: colors.red600 },
  warning: { box: 'border-amber-200 bg-amber-50', text: 'text-amber-800', icon: 'warning', color: colors.amber600 },
  info: { box: 'border-brand-200 bg-brand-50', text: 'text-brand-900', icon: 'information-circle', color: colors.brand700 },
  /** The website's flash success message. */
  success: { box: 'border-green-200 bg-green-50', text: 'text-green-700', icon: 'checkmark-circle', color: colors.brand700 },
};

export function Banner({ message, tone = 'error' }: { message: string; tone?: Tone }) {
  const s = styles[tone];
  return (
    <View accessibilityRole="alert" className={`flex-row items-start gap-2 rounded-md border p-3 ${s.box}`}>
      <Ionicons name={s.icon} size={20} color={s.color} />
      <Text className={`flex-1 text-sm leading-5 ${s.text}`}>{message}</Text>
    </View>
  );
}
