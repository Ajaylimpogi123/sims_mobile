import { ActivityIndicator, Pressable, Text } from 'react-native';

import { colors } from '@/theme/colors';

type Variant = 'primary' | 'outline' | 'danger';

const containerByVariant: Record<Variant, string> = {
  primary: 'bg-brand-700 active:bg-brand-800',
  outline: 'border border-brand-700 bg-white active:bg-brand-50',
  danger: 'border border-red-200 bg-white active:bg-red-50',
};

const labelByVariant: Record<Variant, string> = {
  primary: 'text-white',
  outline: 'text-brand-700',
  danger: 'text-red-600',
};

const spinnerByVariant: Record<Variant, string> = {
  primary: colors.white,
  outline: colors.brand700,
  danger: '#dc2626',
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Label shown while loading, e.g. "Logging in…" */
  loadingLabel?: string;
  className?: string;
}

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, loadingLabel, className = '' }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={`h-12 flex-row items-center justify-center gap-2 rounded-xl px-5 ${containerByVariant[variant]} ${inactive ? 'opacity-60' : ''} ${className}`}>
      {loading ? <ActivityIndicator size="small" color={spinnerByVariant[variant]} /> : null}
      <Text className={`text-base font-semibold ${labelByVariant[variant]}`}>{loading && loadingLabel ? loadingLabel : label}</Text>
    </Pressable>
  );
}
