import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';

const SCALE = [1, 2, 3, 4, 5] as const;

interface RatingPickerProps {
  /** Criterion label, for screen readers ("Punctuality, 4 of 5"). */
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  error?: string | null;
}

/**
 * Tappable 1-5 rating, the editable form of the website's CriteriaRatingGroup (and of the
 * read-only RatingScale from My Feedback): five numbered circles, the chosen score filled in
 * brand green, "Not rated" until one is picked. Larger circles than the read-only scale so each
 * is a comfortable touch target.
 */
export function RatingPicker({ label, value, onChange, disabled = false, error }: RatingPickerProps) {
  return (
    <View className="gap-1.5">
      <View className="flex-row flex-wrap items-center gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
        {SCALE.map((score) => {
          const selected = score === value;
          return (
            <Pressable
              key={score}
              onPress={() => onChange(score)}
              disabled={disabled}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityLabel={`${score} of 5`}
              accessibilityState={{ checked: selected, disabled }}
              className={`h-11 w-11 items-center justify-center rounded-full border ${
                selected ? 'border-brand-700 bg-brand-700' : error ? 'border-red-400 bg-white active:bg-gray-100' : 'border-gray-300 bg-white active:bg-gray-100'
              } ${disabled ? 'opacity-60' : ''}`}>
              <Text className={`text-base font-medium ${selected ? 'text-white' : 'text-gray-700'}`} style={{ fontVariant: ['tabular-nums'] }}>
                {score}
              </Text>
            </Pressable>
          );
        })}
        {value === null ? <Text className="text-xs text-gray-500">Not rated</Text> : null}
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
