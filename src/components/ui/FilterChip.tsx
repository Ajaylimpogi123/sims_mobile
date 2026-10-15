import { Pressable } from 'react-native';
import { Text } from './Text';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** e.g. a count filter with nothing to show (the website disables its toggle the same way). */
  disabled?: boolean;
}

/** A selectable filter pill (status / type filters above a list). */
export function FilterChip({ label, selected, onPress, disabled = false }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      hitSlop={{ top: 6, bottom: 6 }}
      className={`h-9 justify-center rounded-full border px-3.5 ${
        selected ? 'border-brand-700 bg-brand-50' : disabled ? 'border-gray-200 bg-white opacity-50' : 'border-gray-300 bg-white active:bg-gray-100'
      }`}>
      <Text className={`text-sm ${selected ? 'font-semibold text-brand-700' : 'font-medium text-gray-700'}`}>{label}</Text>
    </Pressable>
  );
}
