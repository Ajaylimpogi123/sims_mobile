import { Pressable, View } from 'react-native';
import { Text } from './Text';

interface SegmentedControlProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  error?: string | null;
  disabled?: boolean;
}

/** A short single choice (the website's <Select> with two or three options), label above, 422 error below. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, error, disabled = false }: SegmentedControlProps<T>) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        className={`h-12 flex-row rounded-xl border bg-gray-100 p-1 ${error ? 'border-red-500' : 'border-gray-200'}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              className={`flex-1 items-center justify-center rounded-lg ${selected ? 'border border-gray-200 bg-white' : 'active:bg-gray-200'}`}>
              <Text className={`text-sm ${selected ? 'font-semibold text-brand-700' : 'font-medium text-gray-600'}`}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
