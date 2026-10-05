import { Pressable, Text } from 'react-native';

/** A selectable filter pill (status / type filters above a list). */
export function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 6, bottom: 6 }}
      className={`h-9 justify-center rounded-full border px-3.5 ${selected ? 'border-brand-700 bg-brand-50' : 'border-gray-300 bg-white active:bg-gray-100'}`}>
      <Text className={`text-sm ${selected ? 'font-semibold text-brand-700' : 'font-medium text-gray-700'}`}>{label}</Text>
    </Pressable>
  );
}
