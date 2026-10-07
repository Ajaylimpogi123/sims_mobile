import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable } from 'react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

type Variant = 'primary' | 'outline' | 'danger' | 'destructive';

const containerByVariant: Record<Variant, string> = {
  primary: 'bg-brand-700 active:bg-brand-800',
  outline: 'border border-brand-700 bg-white active:bg-brand-50',
  danger: 'border border-red-200 bg-white active:bg-red-50',
  /** Solid red, like the website's destructive button (e.g. Submit Emergency Time Out). */
  destructive: 'bg-red-600 active:bg-red-700',
};

const labelByVariant: Record<Variant, string> = {
  primary: 'text-white',
  outline: 'text-brand-700',
  danger: 'text-red-600',
  destructive: 'text-white',
};

const contentColorByVariant: Record<Variant, string> = {
  primary: colors.white,
  outline: colors.brand700,
  danger: colors.red600,
  destructive: colors.white,
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Label shown while loading, e.g. "Logging in…" */
  loadingLabel?: string;
  /** Leading icon (hidden while loading, when the spinner takes its place). */
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  loadingLabel,
  icon,
  className = '',
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={onPress}
      className={`h-12 flex-row items-center justify-center gap-2 rounded-xl px-5 ${containerByVariant[variant]} ${inactive ? 'opacity-60' : ''} ${className}`}>
      {loading ? (
        <ActivityIndicator size="small" color={contentColorByVariant[variant]} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={contentColorByVariant[variant]} />
      ) : null}
      <Text className={`text-base font-semibold ${labelByVariant[variant]}`}>{loading && loadingLabel ? loadingLabel : label}</Text>
    </Pressable>
  );
}
